# FPKS 数学排版与编辑验证

这是一个同时包含 **加粗**、*斜体*、`代码`、[链接](https://example.com)与数学公式的混合文档。

行内分式 $\frac{1+\frac{a}{b}}{\sqrt{x^2+y^2}}$，向量 $\vec a + \overrightarrow{AB}$，希腊字母 $\alpha+\beta+\varphi$。

## 字体、括号和上下标

$$
\mathcal{A}+\mathbb{R}+\boldsymbol{\alpha}+z^{*}+A^{\dagger}
\quad \left(\dfrac{a}{b}\right)\quad \lvert x\rvert\quad a\mid b
\quad \bigoplus_{i=1}^{n} V_i\otimes W_i
$$

$$
f(x)=\begin{cases}
\frac{\sin x}{x} & x\ne 0\\
1 & x=0
\end{cases}
\qquad T_{i,j,k}\quad \underbrace{a+b+\cdots+z}_{26\text{ 项}}
$$

> 分段函数、嵌套分式、根号和重音保持完整；公式可在窄窗口中横向滚动。

| 项目 | 表达式 |
| --- | --- |
| 导数 | $\dfrac{\mathrm{d}^{n}}{\mathrm{d}t^{n}}$ |
| 内积 | $\langle u,v\rangle$ |

- 普通列表 $a_i+b_i$
- 公式前后文字保持正常

```latex
代码块中的 $x$ 和 $$y$$ 保留原文。
```

## 编辑验证

```mermaid
flowchart LR
    A[输入 LaTeX] --> B[FPKS 数学排版]
    B --> C[阅读与编辑]
```

图表和普通段落之间的公式 $x^2+y^2=z^2$ 保持正常。

在此区域测试 mk、dm、ddnt、//、Tab、Shift+Tab、矩阵 Enter 和自动分式。

$\dfrac{\mathrm{d}^{3}}{\mathrm{d}t^{3}}$
本机编辑验证 😀 $\dfrac{\mathrm{d}^{4}}{\mathrm{d}t^{4}}$