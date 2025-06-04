import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// 确保必要的目录存在
const uploadDir = 'uploads';
const dataDir = 'data';
const thumbnailDir = 'thumbnails';
const fileInfoPath = path.join(dataDir, 'files.json');

[uploadDir, dataDir, thumbnailDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// 初始化文件信息JSON
if (!fs.existsSync(fileInfoPath)) {
    fs.writeFileSync(fileInfoPath, JSON.stringify([], null, 2));
}

// 缩略图生成函数
async function generateThumbnail(filePath, filename) {
    try {
        const thumbnailPath = path.join(thumbnailDir, filename);
        
        // 如果缩略图已存在，直接返回
        if (fs.existsSync(thumbnailPath)) {
            return thumbnailPath;
        }

        // 生成缩略图
        await sharp(filePath)
            .resize(300, 225, {
                fit: 'cover',
                position: 'centre'
            })
            .toFile(thumbnailPath);

        return thumbnailPath;
    } catch (error) {
        throw error;
    }
}

// 文件信息管理函数
function loadFileInfo() {
    try {
        const data = fs.readFileSync(fileInfoPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function saveFileInfo(fileInfo) {
    try {
        fs.writeFileSync(fileInfoPath, JSON.stringify(fileInfo, null, 2), 'utf8');
        return true;
    } catch (error) {
        return false;
    }
}

function getUniqueFileName(originalName, fileInfo) {
    // 获取文件名和扩展名
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    
    // 转义正则表达式特殊字符
    const escapedNameWithoutExt = nameWithoutExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 检查是否存在同名文件
    const existingFiles = fileInfo.filter(file => {
        const lowerOriginal = file.originalName.toLowerCase();
        const lowerInput = originalName.toLowerCase();
        const lowerNameWithoutExt = nameWithoutExt.toLowerCase();
        
        return lowerOriginal === lowerInput ||
               (lowerOriginal.startsWith(lowerNameWithoutExt + ' (') &&
                lowerOriginal.endsWith(')' + ext.toLowerCase()));
    });
    
    if (existingFiles.length === 0) {
        return originalName;
    }
    
    // 找到当前最大的序号
    let maxNum = 0;
    const escapedExt = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedNameWithoutExt}\\s*\\((\\d+)\\)${escapedExt}$`, 'i');
    
    existingFiles.forEach(file => {
        const match = file.originalName.match(pattern);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    
    // 返回新的文件名
    return `${nameWithoutExt} (${maxNum + 1})${ext}`;
}

function addFileInfo(originalName, newName, size, mimeType) {
    const fileInfo = loadFileInfo();
    
    // 获取唯一的原始文件名
    const uniqueOriginalName = getUniqueFileName(originalName, fileInfo);
    
    fileInfo.unshift({  // 新文件添加到列表开头
        id: Date.now().toString(),
        originalName: uniqueOriginalName,
        newName,
        size,
        mimeType,
        uploadTime: new Date().toISOString(),
        lastModified: new Date().toISOString()
    });
    return saveFileInfo(fileInfo);
}

function removeFileInfo(newName) {
    const fileInfo = loadFileInfo();
    const updatedInfo = fileInfo.filter(file => file.newName !== newName);
    return saveFileInfo(updatedInfo);
}

function getFileByNewName(newName) {
    const fileInfo = loadFileInfo();
    return fileInfo.find(file => file.newName === newName);
}

// 配置上传文件存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        try {
            // 处理前端发送的编码文件名
            let decodedName = file.originalname;
            
            // 尝试解码URI组件（前端可能已经编码）
            try {
                decodedName = decodeURIComponent(decodedName);
            } catch (e) {
                // 如果不是URI编码，继续使用原始名称
            }
            
            // 确保UTF-8编码
            if (Buffer.from(decodedName, 'latin1').toString('utf8') !== decodedName) {
                decodedName = Buffer.from(decodedName, 'latin1').toString('utf8');
            }
            
            // 保存原始文件名到req对象，供后续使用
            req.originalFileName = decodedName;
            
            // 获取文件扩展名
            const ext = path.extname(decodedName);
            // 使用时间戳作为存储文件名
            const timestamp = Date.now();
            const newFileName = `${timestamp}${ext}`;
            cb(null, newFileName);
        } catch (error) {
            // 发生错误时使用时间戳作为文件名
            const timestamp = Date.now();
            cb(null, `${timestamp}.unknown`);
        }
    }
});

const upload = multer({ storage: storage });

// 静态文件服务
app.use(express.static('public'));

// 缩略图路由
app.get('/thumbnail/:filename', async (req, res) => {
    try {
        const decodedFilename = decodeURIComponent(req.params.filename);
        const filePath = path.join(uploadDir, decodedFilename);
        
        // 检查原始文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('文件不存在');
        }

        // 检查文件类型
        const fileBuffer = fs.readFileSync(filePath);
        const fileType = await fileTypeFromBuffer(fileBuffer);

        // 只处理图片文件
        if (!fileType || !fileType.mime.startsWith('image/')) {
            return res.status(400).send('不支持的文件类型');
        }

        try {
            // 生成缩略图
            const thumbnailPath = await generateThumbnail(filePath, decodedFilename);
            res.sendFile(thumbnailPath, { root: process.cwd() });
        } catch (error) {
            // 如果生成缩略图失败，返回原图
            res.sendFile(filePath, { root: process.cwd() });
        }
    } catch (error) {
        res.status(500).send('处理缩略图时出错');
    }
});

// 文件下载路由 - 处理文件名编码
app.get('/download/:filename', (req, res) => {
    try {
        // 解码文件名
        const decodedFilename = decodeURIComponent(req.params.filename);
        const filePath = path.join(uploadDir, decodedFilename);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('文件不存在');
        }
        
        // 设置Content-Disposition头，确保文件名正确编码
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(decodedFilename)}`);
        
        // 发送文件
        res.sendFile(filePath, { root: process.cwd() });
    } catch (error) {
        res.status(500).send('文件下载失败');
    }
});

// 获取文件列表(按上传时间降序排列)
app.get('/files', (req, res) => {
    try {
        const fileInfo = loadFileInfo();
        // 验证文件是否真实存在
        const validFiles = fileInfo.filter(file => {
            const filePath = path.join(uploadDir, file.newName);
            return fs.existsSync(filePath);
        });

        // 如果有文件不存在，更新JSON
        if (validFiles.length !== fileInfo.length) {
            saveFileInfo(validFiles);
        }

        // 返回文件信息
        res.json(validFiles.map(file => ({
            id: file.id,
            originalName: file.originalName,
            newName: file.newName,
            size: file.size,
            uploadTime: file.uploadTime,
            mimeType: file.mimeType
        })));
    } catch (err) {
        res.status(500).json([]);
    }
});

// 获取文件信息
app.get('/file-info/:filename', (req, res) => {
    try {
        // 解码文件名
        const decodedFilename = decodeURIComponent(req.params.filename);
        const fileInfo = getFileByNewName(decodedFilename);
        
        if (!fileInfo) {
            return res.status(404).json({ error: '文件信息不存在' });
        }

        const filePath = path.join(uploadDir, decodedFilename);
        
        // 检查文件是否实际存在
        fs.stat(filePath, (err, stats) => {
            if (err) {
                console.error('获取文件信息错误:', err);
                // 文件不存在，从JSON中删除记录
                removeFileInfo(decodedFilename);
                return res.status(404).json({ error: '文件不存在' });
            }
            
            res.json({
                id: fileInfo.id,
                originalName: fileInfo.originalName,
                newName: fileInfo.newName,
                size: fileInfo.size,
                uploadTime: fileInfo.uploadTime,
                mimeType: fileInfo.mimeType,
                modified: stats.mtime
            });
        });
    } catch (error) {
        console.error('文件信息获取错误:', error);
        res.status(400).json({ error: '无效的文件名' });
    }
});

// 普通文件上传
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }
        

        // 检测文件类型
        const buffer = fs.readFileSync(req.file.path);
        const fileType = await fileTypeFromBuffer(buffer);
        const mimeType = fileType ? fileType.mime : 'application/octet-stream';
        
        // 如果是图片，预先生成缩略图
        if (mimeType.startsWith('image/')) {
            try {
                await generateThumbnail(req.file.path, req.file.filename);
            } catch (error) {
                // 继续处理，即使缩略图生成失败
            }
        }
        
        // 保存文件信息到JSON，使用处理后的文件名
        const success = addFileInfo(
            req.originalFileName || req.file.originalname,
            req.file.filename,
            req.file.size,
            mimeType
        );

        if (!success) {
            // 如果保存文件信息失败，删除上传的文件和可能存在的缩略图
            fs.unlinkSync(req.file.path);
            const thumbnailPath = path.join(thumbnailDir, req.file.filename);
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }
            return res.status(500).json({ error: '保存文件信息失败' });
        }
        
        // 文件上传成功
        res.json({ 
            success: true, 
            filename: req.file.filename,
            originalName: req.file.originalname
        });
    } catch (error) {
        // 发生错误时，删除已上传的文件和可能存在的缩略图
        if (req.file) {
            fs.unlinkSync(req.file.path);
            const thumbnailPath = path.join(thumbnailDir, req.file.filename);
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }
        }
        console.error('文件上传错误:', error);
        res.status(500).json({ error: '文件上传失败' });
    }
});

// 文件删除
app.delete('/delete/:filename', (req, res) => {
    try {
        // 解码文件名
        const decodedFilename = decodeURIComponent(req.params.filename);
        const filePath = path.join(uploadDir, decodedFilename);
        const thumbnailPath = path.join(thumbnailDir, decodedFilename);
        
        // 先检查文件信息是否存在
        const fileInfo = getFileByNewName(decodedFilename);
        if (!fileInfo) {
            return res.status(404).json({ error: '文件不存在' });
        }

        // 删除原文件和缩略图
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                return res.status(500).json({ error: '删除文件失败' });
            }

            // 尝试删除缩略图（如果存在）
            if (fs.existsSync(thumbnailPath)) {
                try {
                    fs.unlinkSync(thumbnailPath);
                } catch (error) {
                    console.error('删除缩略图错误:', error);
                    // 继续处理，即使缩略图删除失败
                }
            }

            // 从JSON中删除文件信息
            const success = removeFileInfo(decodedFilename);
            if (!success) {
                return res.status(500).json({ error: '删除文件信息失败' });
            }

            res.json({ 
                success: true, 
                message: `文件 ${fileInfo.originalName} 已删除`
            });
        });
    } catch (error) {
        console.error('文件删除错误:', error);
        res.status(400).json({ error: '无效的文件名' });
    }
});



// 启动服务器
app.listen(port, () => {
    console.log(`文件传输系统运行在 http://localhost:${port}`);
});