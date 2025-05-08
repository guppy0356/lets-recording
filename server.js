const express = require('express');
const app = express();
const port = 3000;

// 静的ファイルの提供
app.use(express.static('public'));

// サーバー起動
app.listen(port, () => {
  console.log(`スクリーンレコーダーアプリが http://localhost:${port} で起動しました`);
});
