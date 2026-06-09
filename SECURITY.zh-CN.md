# 安全说明

`gha-permission-map` 读取本地 workflow 文件，并报告 token 权限声明。它不会调用 GitHub，不会执行 workflow step，也不会读取 secrets。

## 报告方式

如果发现安全问题，请优先通过 GitHub private advisory 报告；不可用时可直接联系维护者。

## 范围

安全相关问题包括：

- 执行 workflow 内容
- 读取请求仓库根目录之外的文件
- 将 workflow 内容发送到网络
- 对已支持语法输出误导性的权限结果

不支持的 YAML 边缘情况通常是普通 bug；除非造成实质误导的安全输出，否则不算安全漏洞。
