<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1M1qY9pr7s9sVz-Vqhscv_aIX4EWRvlN3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Google Flow automation (Puppeteer)

Bạn có hai cách để tự động đưa prompt vào Google Flow và tải video về máy.

### 1. Toàn bộ tự động chỉ với 1 lệnh

Script `automation/fullAutomation.mjs` sẽ:

1. Đọc cấu hình từ `automation/config.json` (hãy tạo file này bằng cách copy từ `automation/config.sample.json`).
2. Gọi Gemini để sinh prompt theo cấu hình.
3. Lưu prompt ra `automation/latest-prompts.json` (có thể đổi đường dẫn trong cấu hình).
4. Mở Chrome, nhập từng prompt vào Google Flow theo nhóm 3 cảnh, đợi render và tải video về thư mục bạn chỉ định.

Chạy lệnh:

```bash
npm run flow:auto
```

- Có thể truyền thêm đường dẫn file cấu hình và thư mục tải video:

  ```bash
  npm run flow:auto ./automation/config.json ./downloads/google-flow
  ```

- Điền `GEMINI_API_KEY` vào file `.env.local` để script tự lấy khi gọi Gemini.
- Nếu muốn dùng Chrome/Chromium đã cài sẵn, cập nhật `browserExecutablePath` trong file cấu hình.
- Trường `userDataDir` giúp tái sử dụng phiên đăng nhập Google giữa các lần chạy (không bắt buộc).
- Các trường quan trọng trong `config.json`:
  - `videoType`: `"story"` hoặc `"live"`.
  - `idea` (đối với story) hoặc các trường `liveAtmosphere`, `liveArtistName`, `liveArtist`, `liveArtistImagePath` (đối với live).
  - `songMinutes` + `songSeconds`: thời lượng bài hát để tính số cảnh.
  - `downloadDirectory`: thư mục sẽ chứa video tải về.
  - `headless`: đặt `true` nếu muốn chạy Chrome ở chế độ nền.

### 2. Dùng prompts đã xuất thủ công

Nếu bạn muốn tự tạo prompt trong giao diện rồi mới chạy tự động hoá:

1. Xuất file JSON bằng nút **"Tải file JSON cho Google Flow"** trong ứng dụng.
2. Chạy lệnh:

   ```bash
   npm run flow:run ./duong-dan-toi-file.json ./thu-muc-tai-video
   ```

   - Tham số đầu tiên: đường dẫn đến file JSON vừa tải.
   - Tham số thứ hai (tuỳ chọn): thư mục muốn lưu video. Nếu bỏ trống, script sẽ tạo `google-flow-downloads` tại thư mục hiện tại.

3. Chrome sẽ mở, bạn chỉ cần đăng nhập tài khoản Google (nếu được hỏi) và xác nhận thư mục tải về ở lần đầu.

> Tham khảo cấu trúc JSON mẫu ở `automation/prompts.sample.json`.
