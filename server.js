const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const configPath = path.join(__dirname, 'apis.json');
const historyPath = path.join(__dirname, 'history.json');

// 検索対象のベースディレクトリ（ユーザーのホームディレクトリ）
const BASE_DIR = process.env.USERPROFILE || process.env.HOME;

// 除外するディレクトリ
const EXCLUDE_DIRS = [
    'AppData', 'node_modules', '.git', 'Local Settings', 
    'Application Data', 'Cookies', 'NetHood', 'PrintHood', 
    'Recent', 'SendTo', 'Start Menu', 'Templates'
];

// アクティブな検索状態の管理
const activeSearches = {};

// サブディレクトリを含めてファイルを取得する関数 (非同期版)
async function getAllFilesAsync(dirPath, extensions, searchId, depth = 0, arrayOfFiles = []) {
    // キャンセルチェック
    if (activeSearches[searchId] && activeSearches[searchId].cancelled) {
        return arrayOfFiles;
    }
    if (depth > 10) return arrayOfFiles;
    
    // 現在のディレクトリを記録（フロントエンドへの進捗表示用）
    if (activeSearches[searchId]) {
        activeSearches[searchId].currentDir = dirPath;
    }

    let files = [];
    try {
        files = await fs.promises.readdir(dirPath);
    } catch (e) {
        return arrayOfFiles;
    }
    
    const extList = extensions ? extensions.split(',').map(e => e.trim().toLowerCase()) : [];

    for (const file of files) {
        if (activeSearches[searchId] && activeSearches[searchId].cancelled) break;
        
        const fullPath = path.join(dirPath, file);
        try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.isDirectory()) {
                if (!EXCLUDE_DIRS.includes(file) && !file.startsWith('.')) {
                    await getAllFilesAsync(fullPath, extensions, searchId, depth + 1, arrayOfFiles);
                }
            } else {
                const ext = path.extname(file).toLowerCase();
                if (extList.length === 0 || extList.includes(ext)) {
                    arrayOfFiles.push({ path: fullPath, stat: stat });
                }
            }
        } catch (e) {}
        
        if (arrayOfFiles.length > 5000) return arrayOfFiles;
    }
    
    return arrayOfFiles;
}

// 利用可能なモデルリストをフロントエンドに渡すAPI
app.get('/api/config', (req, res) => {
    try {
        const rawConfig = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
        const config = JSON.parse(rawConfig);
        res.json({ 
            models: config.models || ['gemini-3.1-flash-lite-preview'],
            baseDir: BASE_DIR
        });
    } catch (e) {
        console.error('apis.jsonの読み込みエラー (/api/config):', e);
        res.json({ models: ['gemini-3.1-flash-lite-preview'], baseDir: BASE_DIR });
    }
});

// ファイルを開くAPI
app.post('/api/open', (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).send('No path');

    // Windowsの 'start' コマンドでファイルを開く
    const command = process.platform === 'win32' ? `start "" "${filePath}"` : `open "${filePath}"`;
    
    exec(command, (error) => {
        if (error) {
            console.error('Failed to open file:', error);
            return res.status(500).json({ error: 'ファイルを開けませんでした。' });
        }
        
        // 学習機能：開いた履歴を保存
        try {
            let history = {};
            if (fs.existsSync(historyPath)) {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
            history[filePath] = (history[filePath] || 0) + 1;
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        } catch (e) {
            console.error('履歴の保存に失敗しました:', e);
        }

        res.json({ success: true });
    });
});

// フォルダ選択ダイアログを開くAPI
app.get('/api/browse', (req, res) => {
    // Windows用のフォルダ選択ダイアログ呼び出し（PowerShellスクリプトを使用）
    const scriptPath = path.join(__dirname, 'browse.ps1');
    const psCommand = `powershell -STA -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
    
    console.log(`[${new Date().toLocaleTimeString()}] フォルダ選択ダイアログを起動中...`);
    exec(psCommand, { encoding: 'utf8' }, (error, stdout) => {
        if (error) {
            console.error('Failed to open folder dialog:', error);
            // スクリプトがない場合は以前のワンライナーを試みる（フォールバック）
            const fallbackCommand = `powershell -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; if($d.ShowDialog() -eq 'OK'){ $d.SelectedPath }"`;
            exec(fallbackCommand, { encoding: 'utf8' }, (fError, fStdout) => {
                if (fError) return res.status(500).json({ error: 'フォルダ選択ダイアログを開けませんでした。' });
                res.json({ path: fStdout.trim().replace(/^\uFEFF/, '') || null });
            });
            return;
        }
        // BOMを除去してトリム
        const selectedPath = stdout.trim().replace(/^\uFEFF/, '');
        res.json({ path: selectedPath || null });
    });
});

// フォルダの候補を返すAPI
app.get('/api/suggest-dirs', (req, res) => {
    const queryPath = req.query.path || '';
    if (!queryPath) return res.json({ suggestions: [] });

    try {
        let dirToRead = queryPath;
        let baseName = '';

        if (!fs.existsSync(queryPath) || !fs.statSync(queryPath).isDirectory()) {
            dirToRead = path.dirname(queryPath);
            baseName = path.basename(queryPath).toLowerCase();
        }

        if (fs.existsSync(dirToRead) && fs.statSync(dirToRead).isDirectory()) {
            const files = fs.readdirSync(dirToRead);
            const suggestions = files
                .filter(file => {
                    try {
                        const fullPath = path.join(dirToRead, file);
                        return fs.statSync(fullPath).isDirectory() && 
                               file.toLowerCase().startsWith(baseName) &&
                               !EXCLUDE_DIRS.includes(file) && !file.startsWith('.');
                    } catch (e) { return false; }
                })
                .map(file => path.join(dirToRead, file))
                .slice(0, 10);
            
            res.json({ suggestions });
        } else {
            res.json({ suggestions: [] });
        }
    } catch (e) {
        res.json({ suggestions: [] });
    }
});

// 検索ステータス取得API
app.get('/api/status', (req, res) => {
    const { id } = req.query;
    if (activeSearches[id]) {
        res.json(activeSearches[id]);
    } else {
        res.json({ currentDir: '', cancelled: false, status: 'not_found' });
    }
});

// 検索キャンセルAPI
app.post('/api/cancel', (req, res) => {
    const { id } = req.body;
    if (activeSearches[id]) {
        activeSearches[id].cancelled = true;
        console.log(`[${id}] 検索がユーザーによってキャンセルされました`);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// 検索API
app.post('/api/search', async (req, res) => {
    const { query, modelName, extensions, searchDir, searchInsideContent, searchId } = req.body;
    
    // 検索対象のディレクトリを決定（指定がなければホームディレクトリ）
    const targetDir = searchDir && fs.existsSync(searchDir) ? searchDir : BASE_DIR;

    const id = searchId || Date.now().toString();
    activeSearches[id] = { currentDir: targetDir, cancelled: false, status: 'scanning' };

    console.log(`\n[${new Date().toLocaleTimeString()}] 検索開始 [ID:${id}]: "${query}"`);
    console.log(`- 検索ディレクトリ: ${targetDir}`);
    console.log(`- 内容検索: ${searchInsideContent ? 'ON' : 'OFF'}`);

    let config;
    try {
        const rawConfig = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
        config = JSON.parse(rawConfig);
    } catch (e) {
        console.error('apis.jsonの読み込みエラー (/api/search):', e);
        delete activeSearches[id];
        return res.status(500).json({ error: 'apis.jsonの読み込みに失敗しました。コマンドプロンプトのエラーログを確認してください。' });
    }

    if (!config.apiKey) {
        delete activeSearches[id];
        return res.status(400).json({ error: 'apis.jsonにapiKeyが設定されていません。' });
    }

    try {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const targetModel = modelName || 'gemini-3.1-flash-lite-preview';
        const modelId = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;
        const model = genAI.getGenerativeModel({ model: modelId });
        
        // ファイルリストを非同期で取得
        console.log('ファイルをスキャン中...');
        const allFiles = await getAllFilesAsync(targetDir, extensions, id);
        
        if (activeSearches[id].cancelled) {
            delete activeSearches[id];
            return res.json({ results: [], cancelled: true });
        }
        
        activeSearches[id].status = 'analyzing';
        activeSearches[id].currentDir = 'AIが分析中です...';
        
        console.log(`- スキャン完了: ${allFiles.length} 件のファイルが見つかりました。`);
        
        if (allFiles.length === 0) {
            console.log('対象ファイルが見つからなかったため、検索を終了します。');
            return res.json({ results: [] });
        }

        // トークン制限を考慮し、内容検索時は対象ファイル数を絞る
        const maxFiles = searchInsideContent ? 1000 : 3000;
        const targetFiles = allFiles.slice(0, maxFiles);
        if (allFiles.length > maxFiles) {
            console.log(`- 注意: ファイル数が多いため、最初の ${maxFiles} 件のみを対象にします。`);
        }

        // 学習履歴の読み込み
        let history = {};
        try {
            if (fs.existsSync(historyPath)) {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
        } catch (e) {}

        let fileListString = '';
        if (searchInsideContent) {
            console.log('テキストファイルの内容を抽出中...');
            let contentReadCount = 0;
            fileListString = targetFiles.map(fileObj => {
                const filePath = fileObj.path || fileObj;
                const mtime = fileObj.stat ? new Date(fileObj.stat.mtime).toLocaleString('ja-JP') : '';
                const openCount = history[filePath] ? ` (過去に開いた回数: ${history[filePath]}回)` : '';
                const ext = path.extname(filePath).toLowerCase();
                let contentSnippet = '';
                // 内容を読み取る拡張子の指定
                if (['.txt', '.md', '.js', '.json', '.html', '.css', '.py', '.c', '.cpp', '.java'].includes(ext)) {
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        if (content.trim()) {
                            contentSnippet = ` (内容抜粋: ${content.substring(0, 600).replace(/\s+/g, ' ')})`;
                            contentReadCount++;
                        }
                    } catch (e) {}
                }
                return `- ${filePath} (更新日時: ${mtime})${openCount}${contentSnippet}`;
            }).join('\n');
            console.log(`- ${contentReadCount} 件のファイル内容を読み取りました。`);
        } else {
            fileListString = targetFiles.map(fileObj => {
                const filePath = fileObj.path || fileObj;
                const mtime = fileObj.stat ? new Date(fileObj.stat.mtime).toLocaleString('ja-JP') : '';
                const openCount = history[filePath] ? ` (過去に開いた回数: ${history[filePath]}回)` : '';
                return `- ${filePath} (更新日時: ${mtime})${openCount}`;
            }).join('\n');
        }

        const currentDate = new Date().toLocaleString('ja-JP');
        const prompt = `現在は ${currentDate} です。
以下のファイルリストの中から、ユーザーの検索クエリに最も関連すると思われるファイルを探してください。
${searchInsideContent ? 'ファイルパス、更新日時、提供されている場合はファイルの内容（抜粋）も考慮して、ユーザーの目的に合致するファイルを特定してください。' : 'ファイル名、パス、更新日時から推測して精査してください。'}

検索クエリ: ${query}

ファイルリスト:
${fileListString}

重要：リスト内に「過去に開いた回数: X回」と記載されているファイルは、ユーザーが日常的に必要としている重要なファイル（お気に入り）です。回数が多いものほど関連度（relevance）を大幅に（1.5倍以上の感覚で）高く評価し、最上位にリストアップしてください。
ユーザーの意図を汲み取り、条件に合致するファイルを最大30件程度、関連度が高い順にリストアップしてください。
結果は必ず以下のJSONフォーマットの配列で返してください（Markdownブロックなどの余分なテキストは不要です）。
[
  { "file": "フルパス", "reason": "そのファイルを選んだ理由を日本語で簡潔に", "relevance": 5 }
]
（relevanceは1〜5の数値で、5が最も関連度が高いことを示します）
`;

        console.log(`AIモデル (${targetModel}) に問い合わせ中...`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const resultText = response.text();
        
        let jsonContent = resultText;
        const matches = resultText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (matches) {
            jsonContent = matches[0];
        }

        const parsedResults = JSON.parse(jsonContent);
        console.log(`- AI分析完了: ${parsedResults.length} 件の結果を返します。`);
        
        delete activeSearches[id];
        res.json({ results: parsedResults, cancelled: false });

    } catch (error) {
        console.error('エラー発生:', error);
        delete activeSearches[id];
        res.status(500).json({ error: error.message || 'AIによる検索中にエラーが発生しました。' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(` AI File Searcher サーバー起動完了`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(` ログ出力中... (このウィンドウを閉じると終了します)`);
    console.log(`========================================`);
    
    // サーバー起動後にブラウザを自動で開く
    const url = `http://localhost:${PORT}`;
    const command = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
    exec(command, (error) => {
        if (error) {
            console.error('ブラウザの起動に失敗しました。手動でURLを開いてください。');
        }
    });
});
