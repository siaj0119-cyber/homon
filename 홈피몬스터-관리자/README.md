# 홈피몬스터 관리자 페이지

## 📁 파일 구성
- `admin.html` — 관리자 페이지 (이 파일 하나를 브라우저에서 열면 됨)
- `admin.css` — 스타일
- `admin.js` — 로직

## 🚀 설정 방법

### 1. admin.js 상단의 CONFIG 수정
```javascript
const CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',  // 여기에 본인 Supabase URL
  SUPABASE_ANON_KEY: 'eyJhbGci...',           // 여기에 본인 Supabase Anon Key
};
```

### 2. Supabase에 관리자 계정 만들기
Supabase 대시보드 → Authentication → Users → Add User
- 이메일 + 비밀번호 설정
- 이 계정으로 관리자 페이지에 로그인

### 3. admin.html을 브라우저에서 열기
더블클릭하면 끝!

## ⚠️ 이 폴더는 이지랜딩과 무관합니다
원하는 위치로 폴더째로 복사해서 사용하세요.
