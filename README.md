# 썸네일 스튜디오

네이버 블로그 썸네일을 **일괄 제작**하는 웹앱입니다. 서버 없이 브라우저에서만 동작하는 정적 사이트라서 이미지가 외부로 전송되지 않습니다.

## 기능

- 이미지 여러 장 드래그&드롭 업로드
- 사이즈 프리셋: 1:1 (네이버 대표이미지), 1.91:1, 16:9, 3:4, 직접 입력
- 이미지 확대/축소 + 드래그로 위치 조정
- 오버레이(어둡게/그라데이션), 제목/부제목 텍스트(한글 폰트 8종), 뱃지
- 스타일은 전체 공통, 제목은 이미지별로 입력 → 전체 ZIP 일괄 다운로드
- JPG / PNG / WebP, 품질 조절

## 로컬 실행

정적 파일이므로 아무 웹서버로 열면 됩니다.

```bash
npx serve .
# 또는
python -m http.server 8000
```

## 배포 (GitHub + Cloudflare Pages)

1. **GitHub 저장소 생성 후 푸시**

   ```bash
   git remote add origin https://github.com/<아이디>/naver-thumbnail-studio.git
   git push -u origin main
   ```

2. **Cloudflare Pages 연결**
   - [Cloudflare 대시보드](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
   - GitHub 계정 연동 후 `naver-thumbnail-studio` 저장소 선택
   - Build settings: 프레임워크 **None**, Build command **비워두기**, Output directory **`/`** (루트)
   - **Save and Deploy** → `https://<프로젝트명>.pages.dev` 주소로 배포 완료

3. 이후에는 `git push`만 하면 자동으로 재배포됩니다.
