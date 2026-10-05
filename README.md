# Velora

A white-and-violet wallpaper studio for Windows and Linux. **0.1.0 is a preview release.**

## Features

- Import local images, GIF and video; local library with favorites, search and export.
- Import publicly accessible Pinterest pins and pinimg links. Private/login-only pins must be downloaded manually.
- Static wallpapers on Windows, GNOME, Cinnamon and KDE; `feh` fallback on other X11 desktops.
- Looping video wallpapers on Windows Explorer and compatible Linux X11 desktops, including monitor selection.
- Default 3840 × 2160 processing. Optional Ultra: denoising, Lanczos scaling, sharpening and subtle contrast/saturation enhancement. This is local processing, not neural super-resolution or HDR reconstruction.
- Gemini image outpainting and AI restoration; original image composited over generated outpaint to protect its center.
- Veo 3.1 image animation: 8 seconds, direct provider 4K generation, then exact selected output dimensions.
- Experimental Gemini Omni video outpainting for clips up to 10 seconds, subject to Google region/model availability. Provider output is 1080p then scaled to the selected resolution. Visual fidelity is not guaranteed.
- Long video alternative: one AI-generated static background with the original video composited on top. Best for static camera shots; the borders are not animated.
- Tray playback, pause on battery/lock and Windows fullscreen applications; startup enabled by default.

## Start

Startup and restoration of your last live wallpaper are enabled by default. The Windows installer launches Velora at completion and the first packaged launch activates the bundled calm video wallpaper. On Linux, launch Velora once after installation to register the XDG autostart entry. Both preferences can be turned off in Settings.

Install the Windows per-user EXE or Linux x64 AppImage/DEB from Releases. Local functions work offline. AI requires your own valid Google AI Studio key, API access and billing. Enter it under **Настройки → Подключение Gemini**. No shared key or free AI credit is included.

Windows: Windows 10/11 x64 with supported graphics drivers and Explorer desktop. Video attachment uses Explorer's undocumented WorkerW mechanism and may require changes after Windows updates. Linux: current x64 distributions with glibc, graphical desktop and appropriate GTK/NSS libraries; X11 for live wallpapers. Wayland live wallpapers are not implemented. KDE static wallpaper requires qdbus6/qdbus; other X11 desktops may require feh. AppImage needs FUSE2 or `--appimage-extract-and-run` where FUSE is unavailable.

4K processing and playback need suitable CPU/GPU, disk space and codecs. There is no duration cap for locally imported video or local enhancement, but available storage and processing resources are finite. Online Pinterest imports are limited to 2 GiB. DRM media is unsupported. Convert unsupported preview codecs using **Улучшить / 4K**.

## Development

Node 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start
```

`pnpm dev` previews the UI in a browser; OS actions explicitly require the desktop build. `node scripts/qa.cjs` checks desktop import, 4K/Ultra, library state and wallpaper attachment. It temporarily starts and stops a test video wallpaper. An isolated profile is used. `pnpm dist:win` and `pnpm dist:linux` build on the matching host OS. CI builds both targets with the lockfile.

## Concurrent users and load

Velora uses a distributed desktop architecture: each installation processes media locally and sends AI requests directly to Google with its owner's key. There is no central Velora generation server, shared queue, shared API key or shared generation bill. The static download site and GitHub Releases serve distribution; opening buttons or playing wallpaper does not call them. This avoids an application-server bottleneck for 1,000 independent users, but is not a guarantee of Google quota or worldwide network availability.

Each desktop admits up to four processing jobs: one running and three waiting. Identical in-flight requests are coalesced, excess jobs fail immediately with a visible queue-full message, and queued jobs can be canceled before submission. Import and wallpaper changes also have concurrency guards. Closing the application cancels pending jobs; they are intentionally not submitted again automatically after restart. Previously chosen wallpaper still restores independently.

Explicit HTTP 429 responses use bounded exponential backoff, jitter and Retry-After. Status reads can retry temporary server/network failures; potentially billable generation submissions are not automatically repeated after ambiguous network/5xx failures. SDK retries are disabled for submissions to avoid overlapping retry policies. Operation polling is staggered. Retries never create additional quota. Google applies quota **per project, not per API key**: https://ai.google.dev/gemini-api/docs/rate-limits.

`node scripts/load-qa.cjs` simulates 1,000 isolated desktop queues and 24,000 clicks: 4,000 accepted tasks, 20,000 coalesced duplicates, plus 1,000 rejected overflows. It checks the one-worker bound and recovery from 400 mocked 429 errors. The simulation makes no Google calls and performs no real video rendering. It validates scheduling and isolation, not 1,000 live cloud generations or CDN throughput. Real cloud throughput requires authorized paid testing with available Google projects and quotas.

## Security and privacy

The renderer is sandboxed with context isolation, no Node integration, a restricted preload bridge, IPC sender validation and a restrictive CSP. Media requests resolve library IDs instead of caller-controlled filesystem paths. Pinterest network requests restrict domains and redirects. API keys use Electron safeStorage (Windows DPAPI; OS keyring on Linux). If a secure Linux backend is unavailable, keys live only in memory. The key is never returned to the renderer after saving or included in installers. AI files go directly to Google; local processing stays on the computer. Google may charge even when a locally tracked request is canceled.

The unsigned Windows installer can trigger SmartScreen. Velora does not disable security controls or remove the download's origin metadata. Public distribution without reputation warnings requires an appropriate distribution channel (e.g. accepted Microsoft Store submission); signing alone does not guarantee immediate SmartScreen reputation.

## Release verification

Check SHA256SUMS.txt beside releases. Builds are not independently security audited. Source-level tests and machine-specific smoke checks cannot guarantee compatibility with every computer. Linux CI validation uses Xvfb; real desktop/Wayland, multiple monitor and hardware-specific certification remain separate tests.

## License

GPL-3.0-or-later; see LICENSE and NOTICE.txt. Third-party dependencies retain their original licenses. FFmpeg is distributed as an external executable from ffmpeg-static 5.3.0. Corresponding build sources and configuration: https://github.com/eugeneware/ffmpeg-static and https://github.com/BtbN/FFmpeg-Builds. FFprobe: https://github.com/joshwnj/ffprobe-static. Inter font is SIL Open Font License 1.1 (public/fonts/LICENSE.txt). The vector logo and bundled illustrative wallpapers were created for this project.

Technical references: https://ai.google.dev/gemini-api/docs/image-generation · https://ai.google.dev/gemini-api/docs/veo · https://ai.google.dev/gemini-api/docs/omni · https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/distribution-feature-status
