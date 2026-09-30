# 更新信息托管与发布

客户端按 Windy 的 IP 来源国家码选择更新源：中国大陆（CN）使用 Gitee，其他已知国家使用 GitHub；国家码缺失或定位不是 IP 来源时默认 Gitee。代理可能影响判断，不使用语言、时区、GPS 或地图中心推测网络地区。Netlify 不再参与新发布流程。

- Gitee：`bytepoem/windy-plugin` 的 `master` 分支，公开文件 API 返回 UTF-8/Base64 内容，无需客户端 token。
- GitHub：`bytepoem/windy-plugin-sun-moon-path` 的 `update-metadata` 分支，通过 Raw 读取 JSON。
- 每次检查从选定来源读取 `latest.json` 与 `<version>/notes.json`。只接受固定文件路径、匹配版本及完整 minor 系列，不在失败时自动切换来源。
- 成功检查按来源和安装版本隔离缓存，最多复用五分钟；重新进入关于页时再次检查。失败不缓存，关闭插件通过已有 AbortController 取消请求。
- 本地预览读取 localhost 的 `release-notes/beta.json` 及相邻历史日志，不进行地区选择或公网更新检查。

## 发布契约

生成器 `scripts/build-update-site.mjs` 从工作区生成当前快照，从明确的 Git tag 读取已发布快照。发布器 `scripts/publish-update-mirrors.py` 只提交 JSON，每个镜像通过一次普通 Git push 原子更新，拒绝版本倒退及覆盖、删除历史快照，不使用 force push。

CI 使用仓库 Secret `GITEE_TOKEN` 和工作流自带的 `GITHUB_TOKEN`，后者需要 `contents: write`。凭据不进入仓库文件或客户端。Gitee 公开 API 可能限流，失败时由用户重试，不自动高频请求。

| 状态与时序 | 对外结果 | 处理 |
| --- | --- | --- |
| 测试、构建、快照生成或本地生产解析失败 | 不发布 | 修复后重跑 |
| Windy 上传失败 | 两个镜像均保持原版本 | 不更新版本指针 |
| Windy 成功 | 先同步 Gitee，再同步 GitHub | 每站 manifest 和全部快照在同一提交上线 |
| 一个镜像成功、另一个失败 | 两边可能暂时处于不同版本，各站内容仍完整 | 修复后只重跑镜像同步及公网验收，成功站点幂等，不重复上传 Windy |
| 两个镜像成功 | 分别用生产解析器验证当前版、旧版发现新版及完整系列 | 公网检查失败则发布任务失败 |
| 并发发布 | CI concurrency 串行处理；普通 Git push 拒绝竞争写入 | 不强制覆盖，重新核对镜像再运行 |
| 插件关闭或请求替换 | 不修改已销毁组件 | 沿 signal 与请求序号处理取消 |

## 验证与恢复

需要支持 TypeScript 类型剥离的 Node.js（CI 使用 Node 24）。在新的临时目录生成：

```sh
node scripts/build-update-site.mjs /tmp/windy-update-site
node scripts/verify-update-site.mjs /tmp/windy-update-site
node scripts/verify-update-site.mjs /tmp/windy-update-site --source=github
# 公网必须已发布相同版本：
node scripts/verify-update-site.mjs --source=gitee
node scripts/verify-update-site.mjs --source=github
python3 scripts/test_publish_update_mirrors.py
```

镜像发布失败后保留 Windy 已成功的版本，只重试镜像步骤。发现已发布日志或客户端错误时发布更高修复版本，不改写旧快照、旧 tag 或旧插件。已有 Netlify 文件不删除，但后续不再同步；仍依赖 Netlify 的旧插件需用户手动安装新版。
