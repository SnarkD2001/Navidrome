import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { mkdir, readdir, stat, unlink, writeFile, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';

const app = express();
const PORT = 3001;

// 配置文件路径
const CONFIG_FILE = './config.json';

// 默认配置
const defaultConfig = {
  musicFolder: '',
  navidromeUrl: '',
  navidromeUser: '',
  navidromeToken: '',
  navidromeSalt: '',
};

// 加载配置
async function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = await readFile(CONFIG_FILE, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return { ...defaultConfig };
}

// 保存配置
async function saveConfig(config) {
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 中间件
app.use(cors());
app.use(express.json());

// Multer 配置 - 临时存储
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma'];
    const ext = extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  },
});

// 获取配置
app.get('/api/config', async (req, res) => {
  const config = await loadConfig();
  res.json(config);
});

// 更新配置
app.put('/api/config', async (req, res) => {
  const config = await loadConfig();
  const newConfig = { ...config, ...req.body };
  await saveConfig(newConfig);
  res.json(newConfig);
});

// 上传音乐文件
app.post('/api/upload', upload.array('files', 50), async (req, res) => {
  try {
    const config = await loadConfig();
    
    if (!config.musicFolder) {
      return res.status(400).json({ error: '请先配置音乐文件夹路径' });
    }

    // 确保音乐文件夹存在
    await mkdir(config.musicFolder, { recursive: true });

    const results = [];

    for (const file of req.files) {
      const targetPath = join(config.musicFolder, file.originalname);
      
      // 移动文件到目标目录
      const { readFile: readFileBuffer, writeFile: writeFileBuffer } = await import('fs/promises');
      const buffer = await readFileBuffer(file.path);
      await writeFileBuffer(targetPath, buffer);
      
      // 删除临时文件
      await unlink(file.path);

      results.push({
        filename: file.originalname,
        size: file.size,
        path: targetPath,
      });
    }

    res.json({
      success: true,
      count: results.length,
      files: results,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取音乐文件列表
app.get('/api/music', async (req, res) => {
  try {
    const config = await loadConfig();
    
    if (!config.musicFolder) {
      return res.json([]);
    }

    if (!existsSync(config.musicFolder)) {
      return res.json([]);
    }

    const files = await readdir(config.musicFolder);
    const musicFiles = [];

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const allowedExts = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma'];
      
      if (allowedExts.includes(ext)) {
        const filePath = join(config.musicFolder, file);
        const fileStat = await stat(filePath);
        
        musicFiles.push({
          filename: file,
          size: fileStat.size,
          modified: fileStat.mtime,
          path: filePath,
        });
      }
    }

    // 按修改时间排序
    musicFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json(musicFiles);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 删除音乐文件
app.delete('/api/music/:filename', async (req, res) => {
  try {
    const config = await loadConfig();
    
    if (!config.musicFolder) {
      return res.status(400).json({ error: '未配置音乐文件夹' });
    }

    const filePath = join(config.musicFolder, req.params.filename);
    
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    await unlink(filePath);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 触发 Navidrome 扫描
app.post('/api/scan', async (req, res) => {
  try {
    const config = await loadConfig();
    
    if (!config.navidromeUrl || !config.navidromeUser || !config.navidromeToken || !config.navidromeSalt) {
      return res.status(400).json({ error: '请先配置 Navidrome 连接信息' });
    }

    // 调用 Navidrome API 触发扫描
    const params = new URLSearchParams({
      u: config.navidromeUser,
      t: config.navidromeToken,
      s: config.navidromeSalt,
      v: '1.16.1',
      c: 'navidrome-uploader',
      f: 'json',
    });

    const scanUrl = `${config.navidromeUrl}/rest/startScan?${params.toString()}`;
    const response = await fetch(scanUrl);
    const data = await response.json();

    res.json({
      success: true,
      message: '扫描已触发',
      data: data['subsonic-response'],
    });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取磁盘使用情况
app.get('/api/stats', async (req, res) => {
  try {
    const config = await loadConfig();
    
    if (!config.musicFolder || !existsSync(config.musicFolder)) {
      return res.json({ fileCount: 0, totalSize: 0 });
    }

    const files = await readdir(config.musicFolder);
    let totalSize = 0;
    let musicCount = 0;

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const allowedExts = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma'];
      
      if (allowedExts.includes(ext)) {
        const filePath = join(config.musicFolder, file);
        const fileStat = await stat(filePath);
        totalSize += fileStat.size;
        musicCount++;
      }
    }

    res.json({
      fileCount: musicCount,
      totalSize,
      folder: config.musicFolder,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制（最大 100MB）' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  console.error('Server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
