import { NextRequest, NextResponse } from 'next/server';
// We cannot import 'zlib' or 'pako' here as per instructions (no new dependencies)
// We will rely on `fetch` to handle Content-Encoding: gzip if server provides it.

interface ProductConfig {
  id: string;
  name: string;
  xmlFile: string;
  // filenamePattern is no longer needed as final filename comes from core-metadata.xml
}

const products: ProductConfig[] = [
  { id: 'ws-windows', name: 'VMware Workstation Pro for Windows', xmlFile: 'ws-windows.xml' },
  { id: 'ws-linux', name: 'VMware Workstation Pro for Linux', xmlFile: 'ws-linux.xml' },
  { id: 'fusion-universal', name: 'VMware Fusion Pro for macOS (Universal)', xmlFile: 'fusion-universal.xml' },
  { id: 'fusion-arm64', name: 'VMware Fusion Pro for macOS (ARM64)', xmlFile: 'fusion-arm64.xml' },
  { id: 'fusion-intel', name: 'VMware Fusion Pro for macOS (Intel)', xmlFile: 'fusion.xml' },
  { id: 'player-linux', name: 'VMware Player for Linux', xmlFile: 'player-linux.xml' },
  { id: 'player-windows', name: 'VMware Player for Windows', xmlFile: 'player-windows.xml' },
  { id: 'vmrc-linux', name: 'VMware Remote Console for Linux', xmlFile: 'vmrc-linux.xml' },
  { id: 'vmrc-macos', name: 'VMware Remote Console for macOS', xmlFile: 'vmrc-macos.xml' },
  { id: 'vmrc-windows', name: 'VMware Remote Console for Windows', xmlFile: 'vmrc-windows.xml' },
];

// Interface for the data this API route will return to the client
interface VersionMetaEntry {
  idForClientSelection: string; // Will be the gzFilePath, unique for dropdown key (Matches client)
  displayVersion: string;       // Text for the dropdown (Matches client)
  gzFilePath: string;     // The exact path from <url>, e.g., "ws/15.5.0/14665864/windows/core/metadata.xml.gz"
  // For sorting and potentially for display or other logic if needed later
  version: string;
  build: string;
  platformOrArch: string;
  type: string; // 'core', 'packages', or other type inferred from path
}

const BASE_XML_URL = "https://softwareupdate.vmware.com/cds/vmw-desktop/";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  const productConfig = products.find(p => p.id === productId);
  if (!productConfig) {
    return NextResponse.json({ error: 'Selected product configuration not found' }, { status: 404 });
  }

  try {
    const mainXmlResponse = await fetch(`${BASE_XML_URL}${productConfig.xmlFile}`, { next: { revalidate: 3600 } });
    if (!mainXmlResponse.ok) {
      return NextResponse.json({ error: `Failed to fetch main XML (${mainXmlResponse.status})` }, { status: mainXmlResponse.status });
    }
    const mainXmlText = await mainXmlResponse.text();
    if (!mainXmlText || !mainXmlText.trim().startsWith('<')) {
      return NextResponse.json({ error: 'Received empty or malformed main XML data.' }, { status: 500 });
    }

    const availableEntries: VersionMetaEntry[] = [];
    const metaMatches = mainXmlText.matchAll(/<metadata>([\s\S]*?)<\/metadata>/g);
    
    for (const match of metaMatches) {
      const metadataContent = match[1];
      const urlMatch = metadataContent.match(/<url>([^<]+)<\/url>/);
      if (urlMatch && urlMatch[1]) {
        const gzFilePath = urlMatch[1].trim();
        
        if (gzFilePath.includes('info-only')) {
          continue;
        }

        const parts = gzFilePath.split('/');
        // Example: productCode/version/build/platformOrArch/type/metadata.xml.gz
        // parts indices:    0    /   1   /  2  /      3       /  4  /       5
        if (parts.length >= 6) {
            const version = parts[1];
            const build = parts[2];
            const platformOrArch = parts[3];
            const type = parts[parts.length - 2]; // The segment before "metadata.xml.gz"
            
            const displayPlatform = platformOrArch.charAt(0).toUpperCase() + platformOrArch.slice(1);
            const displayType = type.charAt(0).toUpperCase() + type.slice(1);

            availableEntries.push({
              idForClientSelection: gzFilePath, // Use the full path as the unique ID
              displayVersion: `${version} (Build ${build}) - ${displayPlatform} - ${displayType}`,
              gzFilePath: gzFilePath,
              version: version,
              build: build,
              platformOrArch: platformOrArch,
              type: type,
            });
        } else if (parts.length === 5 && productId.startsWith('fusion-')) {
            // Handling cases like "fusion/11.1.0/13668589/core/metadata.xml.gz" where platformOrArch might be 'core'
            // For fusion, <url>fusion/11.1.0/13668589/core/metadata.xml.gz</url>
            // parts[0]=fusion, parts[1]=11.1.0, parts[2]=13668589, parts[3]=core, parts[4]=metadata.xml.gz
            const version = parts[1];
            const build = parts[2];
            const platformOrArch = parts[3]; // This is 'core' in the example, but should be an arch like 'universal' or 'arm64'
                                          // The actual platform/arch is part of productConfig.id for fusion like 'fusion-arm64'
            const type = parts[parts.length - 2]; // This is likely 'core'

            // For fusion, the platform/arch is better derived from productId
            let fusionArch = "UnknownArch";
            if (productId === 'fusion-universal') fusionArch = "Universal";
            else if (productId === 'fusion-arm64') fusionArch = "ARM64";
            else if (productId === 'fusion-intel') fusionArch = "Intel";
            else if (productId === 'fusion') fusionArch = "Intel"; // Default fusion.xml is often Intel

            availableEntries.push({
                idForClientSelection: gzFilePath,
                displayVersion: `${version} (Build ${build}) - macOS ${fusionArch} - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                gzFilePath: gzFilePath,
                version: version,
                build: build,
                platformOrArch: fusionArch, // Use derived arch
                type: type,
            });
} else if (parts.length === 5 && productId.startsWith('vmrc-')) {
            // Handle VMRC: vmrc/{version}/{build}/{platform}/metadata.xml.gz
            // Example URL: vmrc/12.0.4/21740317/windows/metadata.xml.gz
            // parts[0]=vmrc (product code from URL, matches start of productId)
            // parts[1]=version (e.g., "12.0.4" - this is the VMRC application version)
            // parts[2]=build (e.g., "21740317")
            // parts[3]=platform (e.g., 'windows', 'linux', 'macos')
            // parts[4]=metadata.xml.gz (filename)

            const versionFromUrl = parts[1]; // Actual VMRC app version from URL
            const buildFromUrl = parts[2];   // Actual VMRC build from URL
            const platformFromUrl = parts[3];
            const type = "App"; // VMRC is a standalone application

            const displayPlatform = platformFromUrl.charAt(0).toUpperCase() + platformFromUrl.slice(1);

            // The <version> tag in the main VMRC XML (e.g., "7.0.0") seems to be a product series designator.
            // We use the version from the URL for display and sorting.
            availableEntries.push({
                idForClientSelection: gzFilePath,
                displayVersion: `VMRC ${versionFromUrl} (Build ${buildFromUrl}) - ${displayPlatform}`,
                gzFilePath: gzFilePath,
                version: versionFromUrl, // Use version from URL
                build: buildFromUrl,     // Use build from URL
                platformOrArch: platformFromUrl,
                type: type,
            });
        }
      }
    }

    if (availableEntries.length === 0) {
      return NextResponse.json({ error: `No valid (non 'info-only') metadata entries found for ${productConfig.name} in ${productConfig.xmlFile}.`, entries: [] }, { status: 200 });
    }

    // Sort entries: newest first by version, then by build, then by type (core first)
    availableEntries.sort((a, b) => {
      const aVerParts = a.version.split('.').map(Number);
      const bVerParts = b.version.split('.').map(Number);
      for (let i = 0; i < Math.max(aVerParts.length, bVerParts.length); i++) {
        const aPart = aVerParts[i] || 0;
        const bPart = bVerParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      const buildDiff = parseInt(b.build, 10) - parseInt(a.build, 10);
      if (buildDiff !== 0) return buildDiff;
      // Sort 'core' before 'packages' or others
      if (a.type === 'core' && b.type !== 'core') return -1;
      if (a.type !== 'core' && b.type === 'core') return 1;
      return a.type.localeCompare(b.type);
    });

    return NextResponse.json(availableEntries);

  } catch (e: any) {
    console.error(`Error processing request for ${productId} in /api/getProductVersions:`, e);
    return NextResponse.json({ error: `Server error processing versions: ${e.message}` }, { status: 500 });
  }
}