# 更新信息托管与发布

正式插件从 `https://bytepoem-windy-updates.netlify.app/latest.json` 读取版本，再读取同源的 `<version>/notes.json` 完整中英文 minor 系列快照。无 GitHub Raw 请求，也不自动切换来源。本地预览仍读取 localhost 的 `release-notes/beta.json` 及相邻历史日志。

## 发布契约

- 客户端：只接受同源、版本匹配且系列完整的快照；失败提供重试，不缓存失败结果；关闭插件沿现有 AbortController 取消请求。
- 生成器：当前系列来自工作区日志，历史已托管版本（自 0.10.3 起）来自对应 Git tag，不改写已发布快照。
- 发布流程：全仓库测试、生产构建、静态更新站点生成及生产解析器验证全部通过后上传 Windy；Windy 成功后才原子部署 Netlify，最后验证公网结果。
- CI 凭据：仓库 Secret `NETLIFY_AUTH_TOKEN`，目标固定为 `bytepoem-windy-updates.netlify.app`。不要把 token 放进仓库或客户端。Netlify token 是账号凭据，命名不会将其权限限制为单个站点。
- `latest.json` 浏览器缓存 5 分钟；版本快照长期缓存。每次完整部署都必须包含已发布快照，避免旧 manifest 缓存引用失效。

| 状态与时序 | 对外结果 | 处理 |
| --- | --- | --- |
| 测试、构建或生成失败 | 不发布 | 修复后重跑 |
| Windy 上传失败 | Netlify 保持旧版本 | 不更新指针 |
| Windy 成功、Netlify 失败 | 新插件已可用，更新服务仍保持旧部署或状态待核对 | 查 Netlify deploy 状态；只重跑失败的同步步骤，避免重复上传 Windy |
| Netlify 发布完成 | manifest 与所有快照同一部署上线 | 公网生产解析器验收 |
| 并行发布 | CI concurrency 串行处理 | 发布器拒绝版本倒退；不允许在 CI 运行时手工部署同一站点 |
| 插件关闭或请求取消 | 不修改已销毁组件 | 沿现有 signal 传播取消 |

## 本地验证

需要支持 TypeScript 类型剥离的 Node.js（CI 使用 Node 24）。在干净临时目录生成，避免把其他文件带入部署。

```sh
node scripts/build-update-site.mjs /tmp/windy-update-site
node scripts/verify-update-site.mjs /tmp/windy-update-site
# 公网验证当前工作区版本，需已发布相同版本：
node scripts/verify-update-site.mjs
```

回滚优先在 Netlify 恢复上一个已验证部署，再核验 latest 与快照；发布器有防版本倒退保护，不用旧工作区直接覆盖新版本。浏览器可能在 5 分钟内仍持有上一份 manifest。已发布的插件和 Git tag 不删除、不改写。旧插件 0.10.3 及以前仍请求 GitHub，安装包含本改动的新版本后才切换到 Netlify。
