# Microsoft Store 提交材料（ApkStart 0.5.8）

> 这份文件是给 Partner Center 表单直接复制用的。包体、图标、清单由脚本产出，
> 只有「注册账号 → 预留名称 → 上传 → 送审」必须在网页上人工完成。

---

## 1. 基本信息

| 字段 | 值 |
|---|---|
| Product name | `ApkStart` |
| Category | Developer tools → Utilities & tools（备选：Productivity） |
| Price | Free |
| Package | `dist/store/ApkStart_0.5.8.0_x64.msix`（x64，约 850 MB） |
| 支持语言 | 简体中文 / English (United States) |
| 官网 | https://github.com/RoutineMiku/apkstart |
| 支持邮箱 | <!-- 填你的邮箱 --> |
| 隐私政策 | https://github.com/RoutineMiku/apkstart/blob/main/docs/privacy.md（或自建页面） |

### 本版新增（Partner Center → **What's new in this version**，直接粘贴）

**中文**
```
0.5.8：
· 新增「本机体检 · 自动配置」：自动检查 CPU 虚拟化是否开启、Windows 虚拟机监控程序平台是否启用、显卡与显存、内存和系统版本。
· 能自动改的直接生效：按本机硬件推荐内存、CPU 核心数、画质与渲染后端，并把这台机器的配置固化成一份驱动。
· 需要管理员权限的操作（开启 Windows 功能、安装加速驱动）提供一键按钮；只能进 BIOS 改的会给出明确步骤。

0.5.7（已包含）：
· 新增「驱动（兼容补丁）」：机器跑不起来时，可以导入或自己写一份 JSON 补丁，声明匹配哪些机器、命中后改哪些启动参数。
· 设置页可直接导入驱动、启用停用、打开驱动目录、导出本机模板；补丁只改白名单里的启动参数，不执行任何代码。
· 内置三个示例驱动（AMD 核显、无硬件加速、老 Intel 核显），默认不启用，按需打开即可。

0.5.6（已包含）：
· 运行时只保留 ApkStart 自带的一套：不再探测、接管或依赖电脑上安装的任何模拟器（MuMu、雷电、蓝叠、WSA 都不再使用）。
· 设置里移除了「引擎模式」和第三方模拟器相关选项，不会再因为导入旧配置而切到别人的模拟器。
· 内存、CPU 核心数与数据分区仍可自行分配，上限按你的电脑配置计算。

0.5.5（已包含）：
· 修复部分电脑上应用画面全黑的问题：自动识别显卡能力并切换渲染档位，画面异常时自动重启重试。
· 支持安装 50GB 级的大型安卓游戏：安装前按实际需求检查磁盘空间，不再装到一半才失败。
· 内存、CPU 核心数与数据分区大小现在可以自己分配，上限跟着你的电脑配置走。
· 数据分区扩容不再「显示成功但实际没扩」：需要重建时会明确告知并二次确认。
· 安装包独立运行，自带运行时，不需要预先安装任何模拟器。

0.5.4（已包含）：
· 修复在 125% / 150% 等非 100% 缩放的屏幕上，独立窗口只显示一部分并偏离角落、点击错位的问题。
· 修复冷启动时被「允许 USB 调试」授权框卡住、误报显卡/虚拟化问题导致开机超时。
· 修复 PackageManager 报告「已安装」但应用文件已丢失、导致应用打不开的问题。
· 修复便携版更新后不重启、反复重新下载的死循环；一键卸载现已正确识别安装版。
· 加强 APK 包名与压缩包解压校验，拒绝恶意路径写入与命令注入。

0.5.3（已包含）：
· 安卓应用的桌面 / 开始菜单快捷方式恢复使用**该应用自己的图标**，不再显示 ApkStart 的品牌图标。
· 把应用固定到任务栏时，任务栏按钮与固定项使用同一个应用图标（每个应用独立身份）。
· 运行器自己的 exe 写入了品牌图标与版本信息，资源管理器里不再显示 Electron 的默认图标和 33.x 版本号。

0.5.2（已包含）：
· 装好后如果系统没开「Windows 虚拟机监控程序平台」，现在会直接打开该设置对话框并告诉你要勾哪一项。
· 提示文案不再建议安装 AEHD 驱动（商店版不能装内核驱动）。
· 以软件模拟运行时，第一次打开应用会弹一次系统通知，说明开启硬件加速可快 5~10 倍。

0.5.1（已包含）：
· 切换到另一个屏幕方向的应用时，等待换向的约 40 秒内会显示「正在切换…」窗口，不再是一片空白桌面。
· 冷启动时不再误报「虚拟机没有网络」并建议重置安卓数据。
· 修复了换向重启后偶发「应用启动失败」的问题。
· 点击另一个应用时，若上一个应用仍在启动，新的启动会排队等待，不再互相打断。
· 开机瞬间一闪而过的控制台黑框已消除；应用窗口不再短暂显示上一个应用的名字。
```

**English**
```
0.5.8:
· New "PC check-up · auto-config": detects whether CPU virtualization is enabled, whether the Windows Hypervisor Platform is on, plus GPU/VRAM, memory and OS build.
· Everything that can be automated is applied: memory, CPU cores, render resolution and render path are tuned for this PC, and the result is saved as a driver for future launches.
· Actions that need administrator rights (enabling Windows features, installing the acceleration driver) get a one-click button; BIOS-only changes come with exact steps.

0.5.7 (included):
· New "drivers" (compatibility patches): when a PC cannot boot the runtime, import or write a JSON patch that declares which machines it matches and which launch options to change.
· Settings can import a driver, toggle it, open the drivers folder, and export a template for this PC. Patches only touch whitelisted launch options and never execute code.
· Three built-in examples (AMD iGPU, no hardware acceleration, old Intel iGPU) are shipped disabled by default.

0.5.6 (included):
· Only ApkStart's own runtime remains: emulators installed on the PC (MuMu, LDPlayer, BlueStacks, WSA) are no longer detected, taken over, or relied on.
· The engine selector and all third-party emulator options were removed from Settings, so an imported old config can no longer switch to someone else's emulator.
· Memory, CPU cores and the /data partition are still user-allocatable, with limits derived from your PC.

0.5.5 (included):
· Fixed black app screens on some PCs: graphics capability is detected and the render path is switched automatically, with a retry when the picture is blank.
· Supports installing large Android games in the 50 GB range: disk space is checked up front instead of failing halfway through.
· Memory, CPU cores and the /data partition size can now be allocated by the user, with limits derived from your PC.
· Growing the data partition no longer reports a fake success: when a rebuild is required, it is stated clearly and confirmed first.
· The package runs standalone with its own bundled runtime; no emulator needs to be installed beforehand.

0.5.4 (included):
· Fixed detached windows showing only partially, sitting off-corner, and misaligned clicks on displays scaled above 100% (125%/150%).
· Fixed cold boot stalling on the "Allow USB debugging" dialog and being misreported as a graphics/virtualization failure.
· Fixed apps that PackageManager reported as installed but whose files were missing and would not launch.
· Fixed portable updates that never restarted and re-downloaded in a loop; one-click uninstall now recognizes installed builds.
· Hardened APK package-name and archive-extraction checks against malicious paths and command injection.

0.5.3 (included):
· Desktop and Start menu shortcuts for Android apps now use each app's own icon again,
  instead of ApkStart's brand icon.
· Pinning an app to the taskbar keeps the same app icon on both the pinned shortcut and
  the running window (each app has its own app identity).
· The runner's own exe now carries the product icon and version info, so Explorer no
  longer shows Electron's default icon and 33.x version number.

0.5.2 (included):
· If the optional Windows feature "Windows Hypervisor Platform" is off, the app opens the
  Windows Features dialog and tells you which item to tick.
· The hint no longer suggests installing the AEHD kernel driver (a Store app cannot).
· In software emulation, the first app launch shows a notification explaining that hardware
  acceleration makes it 5-10x faster.

0.5.1 (included):
· A "switching orientation…" window is shown during the ~40s panel change instead of a blank desktop.
· The startup log no longer falsely reports "no network" and suggests resetting Android data.
· Fixed an occasional "app failed to start" after an orientation restart.
· Launching another app while one is still starting now queues instead of interrupting it.
· No more console-window flash during boot; the window no longer shows the previous app's name.
```

---

## 2. 短描述（≤100 字符）

**中文**
```
双击 APK 即可在 Windows 上运行安卓应用：独立窗口、桌面图标、运行时内置，装完即用。
```

**English**
```
Run Android apps on Windows by double-clicking an APK. Each app gets its own window.
```

---

## 3. 详细描述（≤10,000 字符）

**中文**

```
ApkStart 把安卓应用变成 Windows 上"能被安装和打开"的普通软件。

不用先开模拟器、不用配置 ADB、不用找镜像。装好 ApkStart 之后，你在资源管理器里
双击一个 .apk 文件，它就会自动解析、安装，并在桌面和开始菜单各放一个带真实应用
图标的快捷方式——之后双击那个图标，就是直接启动这个安卓应用。

■ 应用就是一个窗口
每个安卓应用运行在独立窗口里：竖屏应用保持手机比例并铺满屏幕高度，横屏应用按
16:9 铺满；窗口模式可以自由拖动缩放，每个应用的尺寸单独记住。按 F11 随时切换
全屏 / 窗口。

■ 像原生软件一样被找到
安装 APK 后会自动创建桌面与开始菜单快捷方式，Windows 搜索里直接输应用名就能
打开，任务栏也按应用分组。

■ 文件互通
%USERPROFILE%\ApkStartShared 与安卓内的 /sdcard/ApkStartShared 双向同步。
安卓应用存下来的文件，Windows 这边直接就能看到。

■ 一次下载，装完即用
安装包内置完整的 Android 运行时（模拟器、platform-tools、系统镜像），
运行时不下载任何可执行内容。

■ 轻量
壳层零第三方依赖；运行时按需拉起、空闲自动回收。也可以复用你机器上已有的
Android 运行时，额外占用为零。

■ 网络直接用主机的
安卓侧走 QEMU 用户态 NAT，出口复用主机物理网卡，不会创建任何虚拟网卡或
虚拟交换机，不需要装驱动。

──────────── 系统要求 ────────────
· Windows 10 版本 2004（build 19041）或更高，x64
· 需要启用"虚拟机平台"（Windows 功能里的 Windows Hypervisor Platform / WHPX），
  这是微软商店版唯一支持的硬件加速方式（商店应用不允许安装内核驱动）
· 建议 8 GB 以上内存；系统盘预留约 4 GB 用于展开系统镜像

──────────── 首次启动 ────────────
第一次打开会把安装包内的系统镜像展开到 %USERPROFILE%\ApkStart\data
（约 3.3 GB，通常 1 分钟内完成）。之后启动不需要联网。

──────────── 说明 ────────────
· 商店版由 Microsoft Store 负责更新，应用内不提供自更新。
· 卸载应用不会自动删除 %USERPROFILE%\ApkStart\data 里的数据；需要彻底清理时
  请手动删除该目录。
· 本应用不收集个人数据，不含广告，不含内购。
```

**English**（可选，若只提交中文可留空）

```
ApkStart turns Android apps into regular Windows software you can install and open.

After installing ApkStart, double-click any .apk in File Explorer. It is parsed and
installed automatically, and a shortcut with the app's real icon appears on your
Desktop and in the Start menu. Double-clicking that shortcut launches the Android
app directly.

· One app, one window — portrait apps keep their phone aspect ratio and fill the
  screen height; landscape apps fill 16:9. Windowed mode is freely resizable and
  remembers each app's size. F11 toggles full screen.
· Discoverable like native software — Desktop and Start menu shortcuts are created
  on install, so Windows Search finds apps by name.
· Shared files — %USERPROFILE%\ApkStartShared syncs both ways with
  /sdcard/ApkStartShared inside Android.
· One download, ready to use — the Android runtime (emulator, platform-tools,
  system image) ships inside the package. Nothing executable is downloaded at runtime.
· Lightweight — zero third-party dependencies in the shell; the runtime starts on
  demand and is reclaimed when idle.
· Host networking — Android uses QEMU user-mode NAT over the host NIC. No virtual
  adapter, no driver.

Requirements: Windows 10 2004 (build 19041) or later, x64; "Virtual Machine Platform"
(Windows Hypervisor Platform) enabled; 8 GB RAM recommended; ~4 GB free disk for the
system image.

First launch expands the bundled system image to %USERPROFILE%\ApkStart\data
(~3.3 GB, usually under a minute). No network access is needed afterwards.
```

---

## 4. 功能列表（Features，每条 ≤200 字符，最多 20 条）

1. 双击 .apk 自动安装，无需打开模拟器界面
2. 每个应用生成独立桌面图标与开始菜单快捷方式
3. 应用以独立窗口运行，支持全屏 / 窗口模式与尺寸记忆
4. 自动识别竖屏 / 横屏应用并按正确比例铺满
5. Windows 搜索可直接搜到已安装的安卓应用
6. Windows 与安卓共享文件夹双向同步
7. 内置完整运行时，安装后不再下载任何可执行内容
8. 运行时按需启动、空闲回收，壳层零第三方依赖
9. 不创建虚拟网卡、不安装内核驱动，网络直接复用主机
10. 自动授予运行时权限，闪退自动重试

---

## 5. 截图（至少 1 张，建议 4 张）

要求：PNG，**1366×768 或更大**，单张 ≤50 MB，最多 10 张。

建议顺序：

1. 主界面（已装应用卡片）
2. 竖屏应用正在运行（体现独立窗口与铺满）

**已生成，可直接上传**（1920×1080，满足 1366×768 下限）：

| 文件 | 主题 |
|---|---|
| `docs/store-shots/1-main.png` | 双击 APK，即刻运行 |
| `docs/store-shots/2-window.png` | 每个应用都是独立窗口 |

重新生成：

```powershell
npx electron build/store-shots.js
```

脚本只做「真实界面 + 背景 + 文案」的构图，不修改界面本身。
原始截图 `raw-*.png` 由应用的 `--smoke` 截图模式产出（1920×1032）。

---

## 6. Notes for certification（给审核员，必填）

```
ApkStart is an Android app runner for Windows. It bundles Google's official Android
emulator (qemu-system-x86_64.exe) and an AOSP system image inside the MSIX package.
No executable content is downloaded at runtime.

How to test:
1. Install the package and launch ApkStart.
2. On first launch it expands the bundled system image to
   %USERPROFILE%\ApkStart\data (~3.3 GB, about one minute). This is local extraction,
   not a download.
3. Drag any .apk onto the window (or double-click an .apk after enabling the file
   association in Settings) to install it. A shortcut appears on the Desktop.
4. Double-click the shortcut to run the Android app in its own window.

Notes:
· The app does not install APKs from the network on its own; the user must provide
  the .apk file.
· Hardware acceleration uses Windows Hypervisor Platform (WHPX), which is part of
  Windows. No driver or service is installed. If WHPX is not enabled, the app shows
  instructions instead of falling back silently.
· If the "hardware acceleration not enabled" hint appears on the test machine: this is
  expected on a Windows install where the optional feature "Windows Hypervisor
  Platform" (HypervisorPlatform) is turned off. The app cannot enable it by itself
  because MSIX apps cannot elevate. To enable it: Win+R → `optionalfeatures` → tick
  "Windows Hypervisor Platform" → OK → reboot. Everything still works without it
  (software emulation), just much slower. This is a Windows setting, not an app defect.
· Full-trust desktop app (runFullTrust). Data is stored under %USERPROFILE%\ApkStart,
  outside AppData, to avoid MSIX write virtualization breaking child processes.
· No telemetry, no ads, no in-app purchases, no account required.
```

---

## 7. 年龄分级（IARC 问卷）

- 应用本身不含内容，但可运行第三方安卓应用 → 选择「用户可访问第三方内容」
- 不含用户生成内容分享、不含社交功能、不含位置共享
- 结果通常为 3+ / Everyone

---

## 8. 上传步骤（人工，约 15 分钟）

1. 打开 <https://partner.microsoft.com/dashboard>，进入 **Apps and games → New product → MSIX or PWA app**。
2. 预留名称 `ApkStart`，进入 **Product management → Product identity**，
   复制 `Package/Identity/Name` 与 `Package/Identity/Publisher`。
3. 身份值**已经是确认值**（`RoutineMiku.ApkStart` / `CN=58CA1DED-…`），
   直接 `node build/msix.js` 打出来的就是对的；`build/msix.js` 有守卫，
   Publisher 里没有 `58CA1DED` 会直接退出（退出码 3），不会再产出废包。
   仅当 Partner Center 显示的值与此不同才需要覆盖：
   ```powershell
   node build/msix.js --identity "<Identity/Name>" --publisher "<Identity/Publisher>"
   ```
4. **Packages** → 上传 `dist/store/ApkStart_0.5.8.0_x64.msix`，等待校验通过。
5. **Store listing** → 填第 2–5 节的内容、上传截图、选分类。
6. **Pricing and availability** → Free，市场选中国 + 全球。
7. **Submission options** → 粘贴第 6 节的 certification notes。
8. **Age ratings** → 完成 IARC 问卷。
9. 提交审核。首个包通常 1–3 个工作日。

> 不要用 Store submission API 创建首个 submission：一旦用 API 建过，
> 该 submission 就不能再回网页编辑，会进入不可恢复的 error 状态。
