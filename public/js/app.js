// DOM要素の取得
const startBtn = document.getElementById('startBtn');
const shareBtn = document.getElementById('shareBtn');
const stopBtn = document.getElementById('stopBtn');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const timer = document.getElementById('timer');
const downloadContainer = document.getElementById('downloadContainer');
const downloadLink = document.getElementById('downloadLink');

// グローバル変数
let mediaRecorder;
let recordedChunks = [];
let startTime;
let timerInterval;
let screenStream;
let audioStream;
let combinedStream;

// 収録ボタンのイベントリスナー
startBtn.addEventListener('click', async () => {
    try {
        // ブラウザがスクリーンキャプチャをサポートしているか確認
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error('お使いのブラウザはスクリーンキャプチャをサポートしていません。');
        }

        // スクリーンキャプチャの開始
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });

        // プレビューに表示
        preview.srcObject = screenStream;
        
        // ボタンの状態を更新
        startBtn.disabled = true;
        shareBtn.disabled = false;
        
        // ステータスを更新
        status.textContent = 'スクリーンキャプチャ準備完了';
        
        // スクリーンキャプチャが停止された場合（ユーザーがキャンセルした場合など）
        screenStream.getVideoTracks()[0].onended = () => {
            stopRecording();
        };
    } catch (error) {
        console.error('スクリーンキャプチャエラー:', error);
        status.textContent = `エラー: ${error.message}`;
    }
});

// 共有ボタンのイベントリスナー
shareBtn.addEventListener('click', async () => {
    try {
        // マイクの音声を取得
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        // スクリーンとマイクの音声トラックを結合
        const tracks = [
            ...screenStream.getVideoTracks(),
            ...getMixedAudioTracks(screenStream, audioStream)
        ];
        
        combinedStream = new MediaStream(tracks);
        
        // MediaRecorderの設定
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };
        mediaRecorder = new MediaRecorder(combinedStream, options);
        
        // 録画データの処理
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        // 録画終了時の処理
        mediaRecorder.onstop = createDownloadLink;
        
        // 録画開始
        mediaRecorder.start(1000); // 1秒ごとにデータを取得
        
        // タイマーの開始
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        
        // ボタンの状態を更新
        shareBtn.disabled = true;
        stopBtn.disabled = false;
        
        // ステータスを更新
        status.textContent = '録画中...';
    } catch (error) {
        console.error('録画開始エラー:', error);
        status.textContent = `エラー: ${error.message}`;
    }
});

// 停止ボタンのイベントリスナー
stopBtn.addEventListener('click', stopRecording);

// 録画停止関数
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        
        // タイマーの停止
        clearInterval(timerInterval);
        
        // ストリームの停止
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
        }
        
        if (combinedStream) {
            combinedStream.getTracks().forEach(track => track.stop());
        }
        
        // プレビューのクリア
        preview.srcObject = null;
        
        // ボタンの状態を更新
        startBtn.disabled = false;
        shareBtn.disabled = true;
        stopBtn.disabled = true;
        
        // ステータスを更新
        status.textContent = '録画完了';
    }
}

// スクリーンとマイクの音声を混合する関数
function getMixedAudioTracks(screenStream, micStream) {
    const audioContext = new AudioContext();
    
    // スクリーンの音声トラックがある場合
    const screenAudioTracks = screenStream.getAudioTracks();
    const micAudioTracks = micStream.getAudioTracks();
    
    if (screenAudioTracks.length === 0 && micAudioTracks.length === 0) {
        return [];
    }
    
    const destination = audioContext.createMediaStreamDestination();
    
    // スクリーンの音声を追加
    if (screenAudioTracks.length > 0) {
        const screenSource = audioContext.createMediaStreamSource(
            new MediaStream([screenAudioTracks[0]])
        );
        screenSource.connect(destination);
    }
    
    // マイクの音声を追加
    if (micAudioTracks.length > 0) {
        const micSource = audioContext.createMediaStreamSource(
            new MediaStream([micAudioTracks[0]])
        );
        micSource.connect(destination);
    }
    
    return destination.stream.getAudioTracks();
}

// タイマーを更新する関数
function updateTimer() {
    const elapsedTime = Date.now() - startTime;
    const seconds = Math.floor((elapsedTime / 1000) % 60);
    const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
    const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
    
    timer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ダウンロードリンクを作成する関数
function createDownloadLink() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    downloadLink.href = url;
    downloadLink.download = `screen-recording-${timestamp}.webm`;
    downloadLink.textContent = 'クリックしてダウンロード';
    
    // ダウンロードコンテナを表示
    downloadContainer.style.display = 'block';
    
    // 録画データをリセット
    recordedChunks = [];
}

// ブラウザがMediaRecorder APIをサポートしているか確認
if (!window.MediaRecorder) {
    status.textContent = 'お使いのブラウザはMediaRecorder APIをサポートしていません。';
    startBtn.disabled = true;
}
