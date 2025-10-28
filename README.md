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

Sau khi tạo prompt, bạn có thể dùng script Puppeteer đi kèm để tự động mở Google Flow, nhập 3 prompt một lượt và tải video về.

1. Xuất file JSON ngay trong ứng dụng bằng nút **"Tải file JSON cho Google Flow"**.
2. Chạy lệnh:

   ```bash
   npm run flow:run ./duong-dan-toi-file.json ./thu-muc-tai-video
   ```

   - Tham số đầu tiên: đường dẫn đến file JSON vừa tải.
   - Tham số thứ hai (tuỳ chọn): thư mục muốn lưu video. Nếu bỏ trống, script sẽ tạo thư mục `google-flow-downloads` trong thư mục hiện tại.

3. Chrome sẽ mở, bạn chỉ cần đăng nhập tài khoản Google (nếu được yêu cầu) và chọn thư mục tải về trong lần tải đầu tiên.

> Mẹo: Kiểm tra file mẫu ở `automation/prompts.sample.json` để biết đúng cấu trúc JSON.
