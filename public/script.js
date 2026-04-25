document.addEventListener('DOMContentLoaded', () => {
    const modelSelect = document.getElementById('model-select');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const loadingEl = document.getElementById('loading');
    const resultsContainer = document.getElementById('results-container');
    const resultsList = document.getElementById('results-list');
    const browseBtn = document.getElementById('browse-btn');
    const dirInput = document.getElementById('dir-input');
    const dirSuggestions = document.getElementById('dir-suggestions');

    // 拡張子セレクタのUI要素
    const extInput = document.getElementById('ext-input');
    const extModal = document.getElementById('ext-modal');
    const extCategories = document.getElementById('ext-categories');
    const extCloseBtn = document.getElementById('ext-close-btn');
    const extClearBtn = document.getElementById('ext-clear-btn');
    const extApplyBtn = document.getElementById('ext-apply-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const loadingStatus = document.getElementById('loading-status');
    const scanningTextEl = document.getElementById('scanning-dir-text');
    let selectedExts = new Set();
    
    let currentSearchId = null;
    let statusPollInterval = null;

    // モデルリストをサーバーから取得
    fetch('/api/config')
        .then(res => res.json())
        .then(data => {
            modelSelect.innerHTML = '';
            if (data.models && data.models.length > 0) {
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    modelSelect.appendChild(option);
                });
            }
            if (data.baseDir) {
                document.getElementById('base-dir-display').textContent = data.baseDir;
                document.getElementById('dir-input').value = data.baseDir;
            }
        })
        .catch(err => {
            console.error('Config load error:', err);
            modelSelect.innerHTML = '<option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>';
        });

    // 検索処理
    const performSearch = async () => {
        let query = searchInput.value.trim();
        const extensions = document.getElementById('ext-input').value.trim();
        
        // 検索ワードも拡張子も空なら何もしない
        if (!query && !extensions) {
            return;
        }
        
        // 拡張子だけが選ばれていてキーワードが空の場合の代替クエリ
        if (!query && extensions) {
            query = `指定された拡張子（${extensions}）のファイルをすべてリストアップしてください（可能であれば更新日時が新しい順に）`;
        }

        const modelName = modelSelect.value;
        const searchDir = document.getElementById('dir-input').value.trim();
        const searchInsideContent = document.getElementById('deep-search-check').checked;

        // 検索中のフォルダ表示を更新
        const baseDir = document.getElementById('base-dir-display').textContent;
        const targetDir = searchDir || baseDir;
        if (scanningTextEl) {
            scanningTextEl.textContent = `スキャン準備中: ${targetDir}`;
        }
        loadingStatus.textContent = 'ファイルをスキャン中...';

        // UI状態の更新
        loadingEl.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        resultsList.innerHTML = '';
        searchBtn.disabled = true;

        // 検索開始時間の記録
        const startTime = performance.now();
        
        currentSearchId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);

        // ステータスポーリングの開始
        if (statusPollInterval) clearInterval(statusPollInterval);
        statusPollInterval = setInterval(async () => {
            if (!currentSearchId) return;
            try {
                const res = await fetch(`/api/status?id=${currentSearchId}`);
                const data = await res.json();
                if (data.currentDir) {
                    scanningTextEl.textContent = data.currentDir;
                }
                if (data.status === 'analyzing') {
                    loadingStatus.textContent = 'AIがファイルを分析中...';
                }
            } catch (e) {}
        }, 500);

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, modelName, extensions, searchDir, searchInsideContent, searchId: currentSearchId })
            });

            const data = await response.json();
            
            if (statusPollInterval) clearInterval(statusPollInterval);

            if (data.cancelled) {
                resultsList.innerHTML = '<p style="color: #fca5a5;">検索がキャンセルされました。</p>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || '検索中にエラーが発生しました');
            }

            // 検索終了時間の計算
            const endTime = performance.now();
            const searchTime = ((endTime - startTime) / 1000).toFixed(2);

            displayResults(data.results, searchTime);
            
        } catch (error) {
            if (statusPollInterval) clearInterval(statusPollInterval);
            resultsList.innerHTML = `<div class="error-message">${error.message}</div>`;
            resultsContainer.classList.remove('hidden');
        } finally {
            if (statusPollInterval) clearInterval(statusPollInterval);
            loadingEl.classList.add('hidden');
            searchBtn.disabled = false;
            currentSearchId = null;
        }
    };
    
    // キャンセル処理
    cancelBtn.addEventListener('click', async () => {
        if (currentSearchId) {
            cancelBtn.textContent = 'キャンセル中...';
            try {
                await fetch('/api/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: currentSearchId })
                });
            } catch (e) {}
            cancelBtn.textContent = '中止する';
        }
    });

    // 結果の表示
    const displayResults = (results, searchTime) => {
        resultsList.innerHTML = '';

        if (searchTime) {
            const timeInfo = document.createElement('div');
            timeInfo.className = 'search-time-info';
            timeInfo.textContent = `⏱ 検索時間: ${searchTime}秒`;
            resultsList.appendChild(timeInfo);
        }

        if (!results || results.length === 0) {
            const noRes = document.createElement('p');
            noRes.style.color = '#94a3b8';
            noRes.textContent = '該当するファイルは見つかりませんでした。';
            resultsList.appendChild(noRes);
        } else {
            results.forEach((result, index) => {
                const item = document.createElement('div');
                item.className = 'result-item';
                
                // 上位3件のハイライトクラス
                if (index === 0) item.classList.add('top-1');
                else if (index === 1) item.classList.add('top-2');
                else if (index === 2) item.classList.add('top-3');

                item.title = 'クリックしてファイルを開く';
                
                const fileEl = document.createElement('div');
                fileEl.className = 'result-file';
                
                const pathSpan = document.createElement('span');
                pathSpan.className = 'file-path-text';
                pathSpan.innerHTML = `📄 ${escapeHTML(result.file)}`;
                
                // 関連度（星）の生成
                let starsHTML = '';
                if (result.relevance) {
                    const score = Math.max(1, Math.min(5, parseInt(result.relevance) || 3));
                    const stars = '★'.repeat(score) + '☆'.repeat(5 - score);
                    starsHTML = `<span class="relevance-stars" title="関連度: ${score}/5">${stars}</span>`;
                }
                
                fileEl.appendChild(pathSpan);
                if (starsHTML) {
                    fileEl.insertAdjacentHTML('beforeend', starsHTML);
                }
                
                const reasonEl = document.createElement('div');
                reasonEl.className = 'result-reason';
                reasonEl.textContent = result.reason;
                
                item.appendChild(fileEl);
                item.appendChild(reasonEl);

                // クリックでファイルを開く
                item.addEventListener('click', () => {
                    openFile(result.file);
                });

                resultsList.appendChild(item);
            });
        }
        
        resultsContainer.classList.remove('hidden');
    };

    // ファイルを開くリクエスト
    const openFile = async (filePath) => {
        try {
            const response = await fetch('/api/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath })
            });
            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'ファイルを開けませんでした');
            }
        } catch (error) {
            console.error('Open error:', error);
            alert('通信エラーが発生しました');
        }
    };

    // XSS対策
    const escapeHTML = (str) => {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    };

    // イベントリスナー
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // フォルダ参照
    browseBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/browse');
            const data = await response.json();
            if (data.path) {
                dirInput.value = data.path;
            }
        } catch (error) {
            console.error('Browse error:', error);
            alert('フォルダ選択中にエラーが発生しました');
        }
    });

    // フォルダ候補の取得 (デバウンス処理)
    let suggestTimeout;
    dirInput.addEventListener('input', () => {
        clearTimeout(suggestTimeout);
        const path = dirInput.value.trim();
        if (path.length < 2) return;

        suggestTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/suggest-dirs?path=${encodeURIComponent(path)}`);
                const data = await response.json();
                
                dirSuggestions.innerHTML = '';
                if (data.suggestions) {
                    data.suggestions.forEach(suggestion => {
                        const option = document.createElement('option');
                        option.value = suggestion;
                        dirSuggestions.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Suggest error:', error);
            }
        }, 300);
    });

    // --- 拡張子マルチセレクトUIのロジック ---
    const extData = [
        { cat: 'ドキュメント', exts: ['.txt', '.md', '.doc', '.docx', '.pdf', '.csv', '.xls', '.xlsx', '.ppt', '.pptx'] },
        { cat: '画像・デザイン', exts: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.psd', '.ai'] },
        { cat: '動画・音声', exts: ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.m4a', '.ogg'] },
        { cat: '動画編集プロジェクト', exts: ['.ymmp', '.prproj', '.aep', '.drp', '.veg', '.fcpx', '.aup'] },
        { cat: 'プログラミング', exts: ['.js', '.ts', '.html', '.css', '.json', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.php', '.rb', '.xml', '.yaml', '.sql'] },
        { cat: 'システム・圧縮', exts: ['.exe', '.bat', '.ps1', '.dll', '.sys', '.ini', '.log', '.zip', '.rar', '.7z', '.tar', '.gz'] }
    ];

    // モーダルの生成
    extData.forEach(group => {
        const catDiv = document.createElement('div');
        catDiv.className = 'ext-category';
        catDiv.innerHTML = `<div class="ext-category-title">${group.cat}</div>`;
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'ext-chips';
        
        group.exts.forEach(ext => {
            const chip = document.createElement('div');
            chip.className = 'ext-chip';
            chip.textContent = ext;
            chip.dataset.ext = ext;
            chip.addEventListener('click', () => {
                if (selectedExts.has(ext)) {
                    selectedExts.delete(ext);
                    chip.classList.remove('selected');
                } else {
                    selectedExts.add(ext);
                    chip.classList.add('selected');
                }
                updateExtInputDisplay();
            });
            chipsDiv.appendChild(chip);
        });
        catDiv.appendChild(chipsDiv);
        extCategories.appendChild(catDiv);
    });

    const updateExtInputDisplay = () => {
        if (selectedExts.size === 0) {
            extInput.value = '';
        } else {
            extInput.value = Array.from(selectedExts).join(', ');
        }
    };

    extInput.addEventListener('click', () => {
        extModal.classList.toggle('hidden');
    });

    extCloseBtn.addEventListener('click', () => extModal.classList.add('hidden'));
    extApplyBtn.addEventListener('click', () => extModal.classList.add('hidden'));
    
    extClearBtn.addEventListener('click', () => {
        selectedExts.clear();
        document.querySelectorAll('.ext-chip').forEach(c => c.classList.remove('selected'));
        updateExtInputDisplay();
    });

    // モーダル外クリックで閉じる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ext-selector-wrapper')) {
            extModal.classList.add('hidden');
        }
    });

});
