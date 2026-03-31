# Vmware Index

> [!IMPORTANT]
> **Service Disruption Notice**
>
> The DNS record for `softwareupdate-prod.broadcom.com` has been removed, making the upstream data source for this project unavailable.
> As a result, all product information and download link generation features are **temporarily out of service**.
>
> The timeline for restoration is currently unknown. We apologize for any inconvenience.

This project indexes VMware (now Broadcom) product download information. It fetches and parses XML metadata files to provide direct download URLs.

## Docker Compose Deployment

This project can be deployed as a single Next.js service with Docker Compose.

```bash
docker compose up -d --build
```

After startup, open:

[`http://localhost:3000`](http://localhost:3000)

To stop the service:

```bash
docker compose down
```

## Base URL

The primary source for product metadata is:
[`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/)

_Note: This replaces the older `https://softwareupdate.vmware.com` base URL._

## Product Metadata XML Files

The project utilizes several XML files, each representing a specific product or product line. These are found under the base URL:

- `fusion-arm64.xml`
- `fusion-universal.xml`
- `fusion.xml`
- `player-linux.xml`
- `player-windows.xml`
- `vmrc-linux.xml`
- `vmrc-macos.xml`
- `vmrc-windows.xml`
- `ws-linux.xml`
- `ws-windows.xml`

The full paths to these files would be, for example:
[`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion-arm64.xml`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion-arm64.xml)

## XML Content Structure

Each XML file contains a list of metadata entries. Here's an example snippet from `fusion-arm64.xml`:

```xml
<metaList>
  <metadata>
    <productId>fusion-arm64</productId>
    <version>13.0.0</version>
    <url>fusion/13.0.0/20802013/arm64/core/metadata.xml.gz</url>
    <locale></locale>
  </metadata>
  <!-- ... other metadata entries ... -->
</metaList>
```

Key fields:
- [`<productId>`](#): Identifier for the product.
- [`<version>`](#): Product version.
- [`<url>`](#): Relative path to further metadata or the download package.

## Project Goal

This project aims to:
1. Fetch these primary XML files.
2. Parse the metadata contained within.
3. Resolve relative URLs to generate full, direct download links for various VMware product versions and components.

## Example Download URLs

The following are examples of download URLs that can be derived. (Note: These specific versions might change; the project's goal is to generate current links based on the XMLs.)

### Workstation / Fusion

**Windows:**
[`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/17.6.3/24583834/windows/core/VMware-workstation-17.6.3-24583834.exe.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/17.6.3/24583834/windows/core/VMware-workstation-17.6.3-24583834.exe.tar)

**Linux:**
[`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/17.5.2/23775571/linux/core/VMware-Workstation-17.5.2-23775571.x86_64.bundle.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/17.5.2/23775571/linux/core/VMware-Workstation-17.5.2-23775571.x86_64.bundle.tar)

**macOS (Fusion):**
- Universal: [`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/13.0.2/21581413/universal/core/com.vmware.fusion.zip.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/13.0.2/21581413/universal/core/com.vmware.fusion.zip.tar)
- Intel (x86): [`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/12.2.4/20071091/x86/core/com.vmware.fusion.zip.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/12.2.4/20071091/x86/core/com.vmware.fusion.zip.tar)
- ARM64: [`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/12.2.0/18760249/arm64/core/com.vmware.fusion.zip.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/12.2.0/18760249/arm64/core/com.vmware.fusion.zip.tar)

### Player

**Linux:**
[`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/player/17.6.0/24238078/linux/core/VMware-Player-17.6.0-24238078.x86_64.bundle.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/player/17.6.0/24238078/linux/core/VMware-Player-17.6.0-24238078.x86_64.bundle.tar)

**Windows:**
[`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/player/17.5.2/23775571/windows/core/VMware-player-17.5.2-23775571.exe.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/player/17.5.2/23775571/windows/core/VMware-player-17.5.2-23775571.exe.tar)

### Tools

- Windows Tools: [`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/17.6.0/24238078/windows/packages/tools-windows-x86.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/17.6.0/24238078/windows/packages/tools-windows-x86.tar)
- Linux Tools (Workstation): [`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/16.2.1/18811642/linux/packages/vmware-tools-linux-11.3.5-18557794.x86_64.component.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/ws/16.2.1/18811642/linux/packages/vmware-tools-linux-11.3.5-18557794.x86_64.component.tar)
- Linux Tools (Fusion): [`https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/11.0.3/12992109/packages/com.vmware.fusion.tools.linux.zip.tar`](https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/fusion/11.0.3/12992109/packages/com.vmware.fusion.tools.linux.zip.tar)
