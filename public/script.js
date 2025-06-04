// 获取DOM元素
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const uploadProgress = document.getElementById('uploadProgress');
const deleteModal = document.getElementById('deleteModal');
const deleteFileName = document.getElementById('deleteFileName');
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');

// 当前删除操作的文件信息
let currentDeleteFile = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadFileList();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    // 文件拖放相关事件
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // 删除确认对话框事件
    confirmDelete.addEventListener('click', handleConfirmDelete);
    cancelDelete.addEventListener('click', hideDeleteModal);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) hideDeleteModal();
    });
}

// 处理拖放事件
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
    fileInput.value = ''; // 清空input，允许重复选择相同文件
}

// 处理文件上传
async function handleFiles(files) {
    const totalFiles = files.length;
    let uploadedFiles = 0;

    // 创建总进度条
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.innerHTML = `
        <div class="progress-header">
            <span class="progress-title">正在上传 ${totalFiles} 个文件</span>
            <span class="progress-count">${uploadedFiles}/${totalFiles}</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
    `;
    uploadProgress.appendChild(progressContainer);

    const progressFill = progressContainer.querySelector('.progress-fill');
    const progressCount = progressContainer.querySelector('.progress-count');

    for (const file of files) {
        try {
            await uploadFile(file);
            uploadedFiles++;
            const progress = (uploadedFiles / totalFiles) * 100;
            progressFill.style.width = `${progress}%`;
            progressCount.textContent = `${uploadedFiles}/${totalFiles}`;
        } catch (error) {
            console.error('上传失败:', error);
            showToast(`文件 ${file.name} 上传失败`, 'error');
        }
    }

    // 上传完成后移除进度条
    setTimeout(() => {
        progressContainer.remove();
    }, 2000);

    // 刷新文件列表
    loadFileList();
}

// 上传单个文件
async function uploadFile(file) {
    const formData = new FormData();
    // 创建文件副本并确保文件名正确编码
    const fileCopy = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified
    });
    formData.append('file', fileCopy);

    const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('上传失败');
    }

    const result = await response.json();
    if (result.success) {
        showToast(`文件 ${file.name} 上传成功`, 'success');
    } else {
        throw new Error(result.error || '上传失败');
    }
}

// 加载文件列表
async function loadFileList() {
    try {
        const response = await fetch('/files');
        const files = await response.json();
        
        if (files.length === 0) {
            fileList.innerHTML = '<div class="no-files">暂无文件</div>';
            return;
        }

        fileList.innerHTML = files.map(file => createFileElement(file)).join('');
        
        // 为图片添加点击预览事件
        // document.querySelectorAll('.file-item[data-is-image="true"]').forEach(item => {
        //     item.addEventListener('click', (e) => {
        //         // 如果点击的是操作按钮，不触发预览
        //         if (e.target.closest('.file-actions')) return;
                
        //         const filename = item.dataset.filename;
        //         window.open(`/preview/${encodeURIComponent(filename)}`, '_blank');
        //     });
        // });
    } catch (error) {
        console.error('加载文件列表失败:', error);
        showToast('加载文件列表失败', 'error');
    }
}

// 创建文件元素
function createFileElement(file) {
    const fileSize = formatFileSize(file.size);
    const uploadTime = new Date(file.uploadTime).toLocaleString();
    const fileIcon = getFileIcon(file.mimeType);
    const isImage = file.mimeType.startsWith('image/');
    
    // 为图片类型创建预览
    const previewContent = isImage 
        ? `<img src="/thumbnail/${file.newName}" alt="${file.originalName}" loading="lazy">`
        : `<i class="${fileIcon}"></i>`;
    
    return `
        <div class="file-item" data-filename="${file.newName}" data-original-name="${file.originalName}" data-is-image="${isImage}" ${isImage ? 'style="cursor: pointer;"' : ''}>
            <div class="file-preview">
                ${previewContent}
            </div>
            <div class="file-info">
                <div class="file-name">${file.originalName}</div>
                <div class="file-meta">
                    <span title="${uploadTime}"><i class="fas fa-clock"></i> ${formatDate(file.uploadTime)}</span>
                    <span><i class="fas fa-weight-hanging"></i> ${fileSize}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="download-btn" onclick="downloadFile('${file.newName}')" title="下载">
                    <i class="fas fa-download"></i>
                </button>
                <button class="delete-btn" onclick="showDeleteModal('${file.newName}', '${file.originalName}')" title="删除">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}

// 格式化日期，显示相对时间
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
        return date.toLocaleDateString();
    } else if (diffDay > 0) {
        return `${diffDay}天前`;
    } else if (diffHour > 0) {
        return `${diffHour}小时前`;
    } else if (diffMin > 0) {
        return `${diffMin}分钟前`;
    } else {
        return '刚刚';
    }
}

// 显示删除确认对话框
function showDeleteModal(filename, originalName) {
    currentDeleteFile = { filename, originalName };
    
    // 创建文件预览/图标
    const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
    const previewContent = fileItem ? fileItem.querySelector('.file-preview').innerHTML : 
        `<i class="${getFileIcon('')}"></i>`;
    
    deleteFileName.innerHTML = `
        <div class="file-preview-preview">
            ${previewContent}
        </div>
        <div class="file-name-preview">${originalName}</div>
    `;
    
    // 显示模态框
    deleteModal.classList.add('active');
    // 禁用页面滚动
    document.body.style.overflow = 'hidden';
    
    // 添加键盘事件监听
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            hideDeleteModal();
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // 保存事件监听器以便后续移除
    currentDeleteFile.keyDownHandler = handleKeyDown;
}

// 隐藏删除确认对话框
function hideDeleteModal() {
    deleteModal.classList.remove('active');
    currentDeleteFile = null;
    // 恢复页面滚动
    document.body.style.overflow = '';
    // 重置按钮状态
    confirmDelete.disabled = false;
    confirmDelete.classList.remove('loading');
}

// 处理删除确认
async function handleConfirmDelete() {
    if (!currentDeleteFile || confirmDelete.disabled) return;

    // 设置按钮加载状态
    confirmDelete.disabled = true;
    confirmDelete.classList.add('loading');

    try {
        const response = await fetch(`/delete/${encodeURIComponent(currentDeleteFile.filename)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('删除失败');
        }

        const result = await response.json();
        if (result.success) {
            showToast(result.message, 'success');
            loadFileList(); // 刷新文件列表
        } else {
            throw new Error(result.error || '删除失败');
        }
    } catch (error) {
        console.error('删除文件失败:', error);
        showToast(`删除文件 ${currentDeleteFile.originalName} 失败`, 'error');
    } finally {
        hideDeleteModal();
    }
}

// 下载文件
function downloadFile(filename) {
    const downloadUrl = `/download/${encodeURIComponent(filename)}`;
    window.location.href = downloadUrl;
}

// 获取文件图标
function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) {
        return 'fas fa-image';
    } else if (mimeType.startsWith('video/')) {
        return 'fas fa-video';
    } else if (mimeType.startsWith('audio/')) {
        return 'fas fa-music';
    } else if (mimeType === 'application/pdf') {
        return 'fas fa-file-pdf';
    } else if (mimeType.includes('word')) {
        return 'fas fa-file-word';
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return 'fas fa-file-excel';
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
        return 'fas fa-file-powerpoint';
    } else if (mimeType.includes('compressed') || mimeType.includes('zip') || mimeType.includes('rar')) {
        return 'fas fa-file-archive';
    } else if (mimeType.includes('text/')) {
        return 'fas fa-file-alt';
    } else {
        return 'fas fa-file';
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 添加显示动画
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });

    // 3秒后移除
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}