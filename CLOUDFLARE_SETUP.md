# Decap CMS 세팅 가이드 (GitHub Pages + Cloudflare Worker)

이 문서는 `jan166.github.io/janet-pm/admin/` 에서 콘텐츠를 편집하려고 할 때 필요한 **일회성 세팅** 을 안내합니다. 10~15분 정도 소요.

전체 구조:
```
브라우저 (/admin/)  ─→  Cloudflare Worker  ─→  GitHub OAuth  ─→  GitHub repo
        (Decap CMS)       (토큰 교환 프록시)       (로그인)         (커밋)
```

---

## 1단계 · GitHub OAuth App 생성

1. https://github.com/settings/developers 접속
2. 좌측 메뉴에서 **OAuth Apps** → **New OAuth App** 클릭
3. 아래 값 입력:
   - **Application name**: `janet-pm CMS` (원하는 이름)
   - **Homepage URL**: `https://jan166.github.io/janet-pm`
   - **Application description**: 비워둬도 됨
   - **Authorization callback URL**: `https://janet-pm-auth.<YOUR-CF-SUBDOMAIN>.workers.dev/callback`
     - 👉 `<YOUR-CF-SUBDOMAIN>` 은 다음 단계에서 Cloudflare 가입하면 자동으로 할당됨. 지금은 placeholder로 두고, Worker 배포 후 돌아와서 수정.
4. **Register application** 클릭
5. 다음 화면에서:
   - **Client ID** 를 기록 (예: `Iv1.abc123def456`)
   - **Generate a new client secret** 클릭 → **Client Secret** 기록 (한 번만 보임, 안전한 곳에 저장)

---

## 2단계 · Cloudflare 가입 + Wrangler 설치

Cloudflare 계정이 없다면:
1. https://dash.cloudflare.com/sign-up 에서 가입 (무료)
2. 이메일 인증 완료

로컬에 Wrangler (CF Workers CLI) 설치:
```bash
npm install -g wrangler
# 또는 homebrew로: brew install cloudflare/cloudflare/wrangler
```

로그인:
```bash
wrangler login
# 브라우저가 열리면서 Cloudflare 로그인 → Allow 클릭
```

---

## 3단계 · Worker 배포

```bash
cd cloudflare-worker
wrangler deploy
```

성공하면 이런 메시지가 뜸:
```
Published janet-pm-auth
  https://janet-pm-auth.<YOUR-SUBDOMAIN>.workers.dev
```

이 URL을 기록해두세요. `<YOUR-SUBDOMAIN>` 부분은 Cloudflare가 자동으로 주는 여러분의 고유 식별자입니다 (예: `janet-pm-auth.jan166.workers.dev`).

---

## 4단계 · Worker에 GitHub Secrets 주입

1단계에서 받은 Client ID, Client Secret을 Worker 환경변수로 저장:

```bash
cd cloudflare-worker
wrangler secret put GITHUB_CLIENT_ID
# prompt에 1단계의 Client ID 붙여넣기 → Enter

wrangler secret put GITHUB_CLIENT_SECRET
# prompt에 1단계의 Client Secret 붙여넣기 → Enter
```

두 secret이 제대로 저장됐는지 확인:
```bash
wrangler secret list
```

---

## 5단계 · GitHub OAuth App Callback URL 업데이트

1단계에서 placeholder로 남겨뒀던 callback URL을 진짜 Worker URL로 갱신:

1. https://github.com/settings/developers → 만든 OAuth App 클릭
2. **Authorization callback URL** 을 3단계에서 받은 실제 URL + `/callback` 으로 수정
   - 예: `https://janet-pm-auth.jan166.workers.dev/callback`
3. **Update application** 클릭

---

## 6단계 · Decap CMS 설정에 Worker URL 연결

로컬 레포에서 `admin/config.yml` 열어서 `base_url` 을 본인 Worker URL로 수정:

```yaml
backend:
  name: github
  repo: jan166/janet-pm
  branch: main
  base_url: https://janet-pm-auth.jan166.workers.dev   # ← 여기
  auth_endpoint: auth
```

수정 후 커밋 · 푸시:
```bash
git add admin/config.yml
git commit -m "Wire admin to deployed OAuth proxy"
git push
```

---

## 7단계 · 사용

- https://jan166.github.io/janet-pm/admin/ 접속
- **Login with GitHub** 클릭 → GitHub 로그인 화면 → Authorize
- CMS 어드민 화면 → 원하는 필드 편집 → **Publish** 클릭
- 자동으로 `content/main.json` 에 커밋됨 → GitHub Pages 재배포 (1~2분) → 사이트 반영

---

## 트러블슈팅

**"Failed to authenticate"**
- Worker URL이 Decap config와 GitHub OAuth App callback 둘 다 정확히 일치하는지 확인
- `wrangler secret list` 로 secret이 심어져 있는지 확인

**"404 Not Found" on /admin/**
- GitHub Pages가 아직 재배포 안 됐을 수 있음. 1~2분 기다려보기
- `admin/index.html` + `admin/config.yml` 이 repo에 푸시됐는지 `ls` 로 확인

**"Popup blocked"**
- 브라우저에서 `jan166.github.io` 팝업 허용

---

## 비용

- **Cloudflare Workers**: 무료 플랜 하루 100,000 요청까지. 실제 사용량은 본인 편집 시에만 발생하니 거의 0.
- **GitHub OAuth**: 무료.

---

## 로컬 미리보기 (선택)

admin 페이지를 로컬에서 미리 보고 싶으면:
```bash
cd /Users/user/Documents/portfolio_project_based
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000/admin/` 열기. 단, GitHub OAuth는 로컬 origin 에서 안 되므로 편집은 배포된 사이트에서만 가능.
