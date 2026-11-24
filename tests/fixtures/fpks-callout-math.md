# 态密度

普通段落包含 **加粗**、*斜体*、[链接](https://example.com) 和行内公式 $x>0$。

> [!done] 三维超相对论气体的态密度
> 相对论气体满足
>
> $$
> E=pc=\hbar ck.
> $$
>
> 由三维 $k$ 空间态密度
>
> $$
> g(k)\,dk=\dfrac{g_{\rm spin}Vk^2}{2\pi^2}\,dk
> $$
>
> 和 $dE=\hbar c\,dk$，得到
>
> $$
> g(E)\,dE
> =\dfrac{g_{\rm spin}V}{2\pi^2(\hbar c)^3}E^2\,dE.
> $$

## 嵌套引用与比较符号

> 外层引用，保留普通说明。
>
> > [!note] 公式内真正的大于号
> > $$
> > \begin{aligned}
> > x &> 0\\
> > y &\ge 1
> > \end{aligned}
> > $$
>
> 外层引用结束。

- 列表内的 callout：

  > [!done] 列表里的公式
  > $$a>b$$

- 列表后续项目保持正常。

| 项目 | 表达式 |
| --- | --- |
| 行内比较 | $a>b$ |
| 能量 | $E=\hbar ck$ |

```latex
> $$
> 代码块里的标记和公式保持原文。
> $$
```

## 引用外的公式

$$
p>q\quad\text{且}\quad r<s
$$

最后一个普通段落。
