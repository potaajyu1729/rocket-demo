# Team Orbit

Deno だけで動く、チーム向け技術力チェックアプリです。

## 起動

```sh
deno run --allow-net --allow-read --allow-env server.js
```

ブラウザで http://localhost:8000 を開きます。

## 遊び方

1. 代表者が名前を入力して `Create room` します。
2. 表示された4桁コードをチームメンバーへ共有します。
3. メンバーはコードと名前を入力して参加します。
4. 2人以上そろったら `Start mission`。全員が回答すると自動でロケットが発射され、個人とチームの結果が表示されます。

問題データは `server.js` の `questions` 配列を編集してください。
