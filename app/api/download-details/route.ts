import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';
import { promisify } from 'util';
import { parseStringPromise } from 'xml2js';

const gunzip = promisify(zlib.gunzip);

const BASE_XML_URL = "https://softwareupdate.vmware.com/cds/vmw-desktop/";

// Interface for the parsed XML structure (simplified)
// Note: xml2js typically creates arrays for elements, even if there's only one.
// The [0] is used to access the first (and often only) element.
// Text content is often in '_' property. Attributes are in '$'.

interface XmlComponent {
  // relativePath can be a string or an object with '_' for text and '$' for attributes
  relativePath: (string | { _: string; $: { [key: string]: string } })[];
  payload?: string[];
  componentID?: string[];
  checksum?: [{
    checksumType: string[];
    checksum: string[];
  }];
}

interface XmlComponentList {
  component: XmlComponent[];
}

interface XmlBulletin {
  componentList: XmlComponentList[];
}

interface XmlRoot {
  metadataResponse: { // Changed from 'metadata'
    bulletin: XmlBulletin[];
    //Potentially other top-level elements like version, timeStamp etc. can be added here if needed
  };
}


// Updated to extract all components from a core/packages XML
interface DownloadableItemDetail {
  name: string;
  pathFragment: string;
  finalFileName: string;
  checksumType?: string; // Stores the type of checksum (e.g., "sha256")
  checksumValue?: string; // Stores the actual checksum value
}

// Parses a core-metadata.xml or packages-metadata.xml text and returns all downloadable components
async function extractDownloadableItemsFromInnerXml(innerXmlText: string, pathFragmentToGz: string): Promise<DownloadableItemDetail[]> {
    const items: DownloadableItemDetail[] = [];
    try {
        // The root element in core-metadata.xml is <metadataResponse>
        const parsedXml: XmlRoot = await parseStringPromise(innerXmlText, {
            explicitArray: true, // Ensures elements are always arrays
            trim: true,          // Trims whitespace from text nodes
            charkey: '_',        // Character content key
            attrkey: '$',        // Attribute key
            tagNameProcessors: [(name) => name], // Keep tag names as is
            valueProcessors: [(value) => value], // Keep values as is
        });

        // Check if the root 'metadataResponse' and 'bulletin' elements exist
        if (!parsedXml.metadataResponse || !parsedXml.metadataResponse.bulletin) {
            console.warn("Parsed XML does not contain metadataResponse.bulletin");
            return items;
        }

        for (const bulletin of parsedXml.metadataResponse.bulletin) {
            if (!bulletin.componentList) continue;

            for (const componentList of bulletin.componentList) {
                if (!componentList.component) continue;

                for (const component of componentList.component) {
                    let finalFileName: string | undefined = undefined;
                    if (component.relativePath && component.relativePath[0]) {
                        const rp = component.relativePath[0];
                        if (typeof rp === 'string') {
                            finalFileName = rp;
                        } else if (rp && typeof rp._ === 'string') {
                            finalFileName = rp._;
                        }
                    }

                    let name = component.payload && component.payload[0];
                    if (!name) name = component.componentID && component.componentID[0];
                    if (!name && finalFileName) name = finalFileName; // Fallback to finalFileName

                    let extractedChecksumType: string | undefined = undefined;
                    let extractedChecksumValue: string | undefined = undefined;

                    if (component.checksum && component.checksum[0]) {
                        const checksumData = component.checksum[0];
                        extractedChecksumType = checksumData.checksumType && checksumData.checksumType[0];
                        extractedChecksumValue = checksumData.checksum && checksumData.checksum[0];
                    }

                    if (finalFileName && name) {
                        const item: DownloadableItemDetail = {
                            name: name,
                            pathFragment: pathFragmentToGz,
                            finalFileName: finalFileName
                        };
                        if (extractedChecksumType) {
                            item.checksumType = extractedChecksumType;
                        }
                        if (extractedChecksumValue) {
                            item.checksumValue = extractedChecksumValue;
                        }
                        items.push(item);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error parsing XML with xml2js:", error);
        // Potentially re-throw or handle more gracefully depending on application needs
    }
    return items;
}


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gzFilePath = searchParams.get('gzFilePath');

  if (!gzFilePath) {
    return NextResponse.json({ error: 'gzFilePath is required' }, { status: 400 });
  }

  // Derive pathFragment from gzFilePath (e.g., "fusion/11.1.0/13668589/core/")
  const pathParts = gzFilePath.split('/');
  if (pathParts.length < 2) {
    return NextResponse.json({ error: 'Invalid gzFilePath format' }, { status: 400 });
  }
  const pathFragmentToGz = pathParts.slice(0, -1).join('/') + '/';

  try {
    const gzResponse = await fetch(`${BASE_XML_URL}${gzFilePath}`, { next: { revalidate: 3600 } });

    if (!gzResponse.ok) {
      console.error(`Failed to fetch GZ file for ${gzFilePath}: ${gzResponse.status}`);
      return NextResponse.json({ error: `Failed to fetch GZ file (${gzResponse.status}) from ${gzFilePath}` }, { status: gzResponse.status });
    }
    
    const gzipBuffer = await gzResponse.arrayBuffer();
    if (!gzipBuffer || gzipBuffer.byteLength === 0) {
      console.error(`Received empty GZ buffer for ${gzFilePath}`);
      return NextResponse.json({ error: 'Received empty GZ buffer.' }, { status: 500 });
    }

    let innerXmlText: string;
    try {
      const decompressedBuffer = await gunzip(Buffer.from(gzipBuffer));
      innerXmlText = decompressedBuffer.toString('utf-8');
    } catch (unzipError: any) {
      console.error(`Failed to decompress Gzip for ${gzFilePath}: ${unzipError.message}`);
      return NextResponse.json({ error: `Failed to decompress Gzip data: ${unzipError.message}` }, { status: 500 });
    }
    
    if (!innerXmlText || !innerXmlText.trim().startsWith('<')) {
      console.warn(`Decompressed data is not valid XML for ${gzFilePath}.`);
      return NextResponse.json({ error: 'Decompressed data is not valid XML.' }, { status: 500 });
    }

    const downloadableItems = await extractDownloadableItemsFromInnerXml(innerXmlText, pathFragmentToGz);

    if (downloadableItems.length === 0) {
      return NextResponse.json({ error: `No downloadable items found in ${gzFilePath}.`, items: [] }, { status: 200 });
    }
    
    return NextResponse.json(downloadableItems);

  } catch (e: any) {
    console.error(`Error processing request for ${gzFilePath} in /api/download-details:`, e);
    return NextResponse.json({ error: `Server error processing download details: ${e.message}` }, { status: 500 });
  }
}