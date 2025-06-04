# 文件上传管理系统

一个基于Node.js和Express的文件上传管理系统，支持文件上传、下载、删除和缩略图生成功能。

## 功能特性

- 文件上传（支持多文件）
- 文件下载（支持原始文件名）
- 文件预览（支持图片和PDF）
- 缩略图自动生成（图片文件）
- 文件信息管理（记录文件名、大小、类型等）
- 文件删除

## 技术栈

- 后端：Node.js + Express
- 文件处理：multer + sharp + file-type
- 前端：HTML + CSS + JavaScript

## 安装与运行

1. 确保已安装Node.js (>=14.x)
2. 克隆项目
3. 安装依赖：
   ```bash
   npm install
   ```
4. 启动服务：
   ```bash
   node server.js
   ```
5. 访问 `http://localhost:3000`

## 项目结构

```
├── data/                # 文件元数据存储
├── node_modules/        # 依赖模块
├── public/             # 前端静态文件
│   ├── index.html       # 前端主页面
│   ├── script.js       # 前端JavaScript
│   └── style.css       # 前端样式
├── thumbnails/         # 缩略图存储
├── uploads/            # 上传文件存储
├── package.json        # 项目配置
├── package-lock.json   # 依赖锁定文件
└── server.js           # 后端主程序
```

## API文档

### 文件上传
- **POST** `/upload`
- 参数：`file` (表单文件字段)
- 返回：上传文件信息

### 文件下载
- **GET** `/download/:filename`
- 参数：文件名
- 返回：文件内容

### 获取文件列表
- **GET** `/files`
- 返回：文件信息数组

### 获取文件信息
- **GET** `/file-info/:filename`
- 参数：文件名
- 返回：文件详细信息

### 删除文件
- **DELETE** `/delete/:filename`
- 参数：文件名
- 返回：操作结果

### 获取缩略图
- **GET** `/thumbnail/:filename`
- 参数：文件名
- 返回：缩略图文件

## 使用说明

1. 访问 `http://你的IP:3000`
2. 点击"选择文件"按钮选择要上传的文件
3. 点击"上传"按钮提交文件
4. 上传成功后可在文件列表中查看、下载或删除文件
5. 图片文件会自动生成缩略图

## 注意事项

- 图片缩略图尺寸为300x225像素
- 上传的文件存储在`uploads`目录
- 文件元数据存储在`data/files.json`
