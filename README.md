# nvm-windows GUI (Tauri v2 Edition)

[English](README.md) | [中文](README.zh.md)

A graphical user interface for nvm-windows, built on the Tauri v2 architecture. Extremely lightweight and lightning-fast responsiveness.

<video src="https://github.com/Mr-Youngs/nvm-windows-GUI/raw/main/assets/media/demo.mp4" controls="controls" style="max-width: 100%;">
  Your browser does not support the video tag. You can [click here to view/download the demo video](https://github.com/Mr-Youngs/nvm-windows-GUI/raw/main/assets/media/demo.mp4).
</video>

## Screenshots

![image-20260129050721293](assets/images/1.png)
![image-20260129050721293](assets/images/2.png)
![image-20260129050721293](assets/images/3.png)
![image-20260129050721293](assets/images/4.png)
![image-20260129050912251](assets/images/5.png)

## Features

- ✅ **Compact Size**: Core executable is only ~3.5MB.
- ✅ **Version Management**: View, install, switch, and uninstall Node.js versions.
- ✅ **Smart Recommendations**: Automatically fetch Node.js official LTS and latest version recommendations.
- ✅ **Mirror Optimization**: Built-in mirror presets with multi-threaded download speed testing.
- ✅ **Package Management**: View and check for outdated global/project npm packages.
- ✅ **Disk Statistics**: Real-time disk usage statistics for each version.

## Tech Stack

- **Frontend**: React + TypeScript + Ant Design
- **Backend**: Rust (Tauri v2)
- **Bundler**: Webpack + Webpack Dev Server

## Attributions & Acknowledgments

- This project is a third-party GUI tool for [nvm-windows](https://github.com/coreybutler/nvm-windows).
- Core functionality depends on the `nvm-windows` CLI tool. Please ensure `nvm` is installed on your system before use.
- Special thanks to [coreybutler](https://github.com/coreybutler) for developing the excellent open-source project `nvm-windows`.

## License

MIT License
