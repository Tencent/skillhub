# 参与贡献

感谢你帮助改进 skillhub。Bug 修复、API 兼容、测试、文档和交互优化都欢迎。

参与本仓库即表示你同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)，并以 [MIT License](LICENSE) 授权你的贡献。

## 开始之前

1. 搜索现有 Issue 和 Pull Request，避免重复劳动。
2. 较大的功能或行为变更请先开 Issue 讨论方案。
3. 安全漏洞不要公开提交，请阅读 [SECURITY.md](SECURITY.md)。
4. 不要在 Issue、日志、测试夹具、截图或提交中包含密钥、Cookie、内网地址和个人数据。

## 本地开发

需要 Node.js 22+ 和 pnpm 11（与 `package.json` 的 `packageManager` 一致）。

```sh
git clone https://github.com/Tencent/skillhub.git
cd skillhub/dsh-plugin
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

常用脚本：

| 命令 | 作用 |
| --- | --- |
| `pnpm typecheck` | TypeScript 检查，不写 `lib/` |
| `pnpm test` | 构建后跑 `node:test` |
| `pnpm test:coverage` | 对核心模块检查行/函数/分支覆盖率门槛 |
| `pnpm build` | 清空并生成 `lib/`，复制 `src/client.js` |
| `pnpm pack:check` | 检查发布包文件列表 |

测试不访问真实网络，夹具放在 `src/tests/fixtures/`。

### 接入 Harness Web

```sh
dsh plugin --profile web add /absolute/path/to/skillhub/dsh-plugin
dsh web --host 127.0.0.1 --port 3080
```

请绑定 `127.0.0.1`，不要监听 `0.0.0.0`。

| 改动 | 如何生效 |
| --- | --- |
| `src/*.ts`（Host） | 重启 `dsh web` |
| `src/client.js`（Client） | `cp src/client.js lib/client.js` 后强制刷新浏览器 |

插件加载路径一般是 `~/.dsh/profiles/web/node_modules/@tencent/skillhub`。若改的是 git clone 目录，确认 profile 安装的是同一路径。

## 代码约定

- Host 用 TypeScript；浏览器端保持无 JSX 的 `React.createElement`。
- 搜索只走 `GET /api/skills`，不要改用 `/api/v1/search`。
- 安装走 `GET /api/v1/download?slug=...&source=dsh` 的 zip；解压必须能读中央目录 / data descriptor。
- 上游请求必须有超时，并接受 `AbortSignal`。
- 安装必须拒绝路径穿越，且要求存在 `SKILL.md`。
- 不要把 `skillhub install`、curl 或 shell 安装命令写进对话正文。
- 修复解析或安装逻辑时，补不依赖实时网络的测试。
- 不提交 `lib/`、`node_modules/`、`.env`、日志、`skillhub.json` 或本地 skills。
- 不要把密钥、内网地址或真实用户数据放进夹具。

## 提交与 Pull Request

1. 从 `main` 开分支，例如 `fix/unzip-descriptor` 或 `docs/readme`。
2. 每个 PR 只做一件事，避免夹带无关重构。
3. 提交信息用简短祈使句，说明**为什么**改，例如 `Fix zip extract when local headers omit sizes`。
4. 推送前本地运行 `pnpm typecheck` 和 `pnpm test`。
5. 用 GitHub 的 PR 模板填写说明；UI 改动请附截图。
6. 关联 Issue 时写 `Closes #123`。

维护者会看：行为是否符合上述约定、测试是否覆盖、文档是否同步、CI 是否全绿。

## 持续集成

推送到 `main` 或打开 PR 时，GitHub Actions 会：

- 在 Node.js 22 和 24 上安装依赖、类型检查、跑测试
- 在 Node.js 22 上检查核心模块覆盖率门槛
- 检查 `lib/` 未被提交
- 打包并确认 tarball 含 `LICENSE`、Host/Client 与核心模块，且不含 `src/` 与测试

依赖更新由 Dependabot 提交 PR。不必在文档 PR 里顺手升级无关依赖。

## 发布

正式版走 GitHub Release tag，并由 `.github/workflows/publish.yml` 用 npm Trusted Publishing 发到 `@tencent/skillhub`。不要把 `NPM_TOKEN` 写进 workflow。npm 上的无前缀名 `skillhub` 已被占用。

1. 升 `package.json` 的 `version`，把 `CHANGELOG.md` 的 Unreleased 写入该版本，合并进 `main`。
2. 打 annotated tag 并推送，例如 `git tag -a v0.2.2 -m "v0.2.2" && git push origin v0.2.2`。
3. 同时创建 GitHub Release；Actions 里的 Publish 会 `npm publish`。

Trusted Publisher 在 https://www.npmjs.com/package/@tencent/skillhub/access 绑定一次即可：

- Organization or user：`Tencent`
- Repository：`skillhub`
- Workflow filename：`publish.yml`
- Environment name：留空
- Allowed actions：`npm publish`

## 文档

用户能感知的行为变化请改 `README.md`。安全边界变化请改 `SECURITY.md`。发布说明写入 `CHANGELOG.md`。
