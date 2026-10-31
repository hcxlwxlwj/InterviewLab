#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
if ! command -v docker >/dev/null; then
  echo '请先安装并打开 Docker Desktop，然后重新运行本文件。'
  read -r '?按回车退出'
  exit 1
fi
docker compose --env-file .env.personal -f compose.personal.yaml up -d --build
echo '启动命令已完成。首次网页编译可能还需要片刻。'
echo '浏览器打开：http://127.0.0.1:3000/me/resumes'
echo '先注册或登录，再访问简历管理和偏好设置。'
read -r '?按回车退出（容器将继续运行）'
