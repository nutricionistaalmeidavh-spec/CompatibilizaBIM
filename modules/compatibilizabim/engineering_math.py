"""Constrained SymPy backend for engineering studies. Not a normative design checker.

Reuses the local Python runtime rather than loading Pyodide into Electron.
Expression parser is an explicit arithmetic AST allowlist: no Python eval/exec.
"""
from __future__ import annotations
import ast
import json
import math
import sys
import sympy as sp

X = sp.Symbol("x", real=True)
NAMES = {"x": X, "pi": sp.pi, "e": sp.E}
FUNCTIONS = {"sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "sqrt": sp.sqrt,
             "log": sp.log, "exp": sp.exp, "abs": sp.Abs}
OPERATORS = {ast.Add: lambda a,b:a+b, ast.Sub:lambda a,b:a-b,
             ast.Mult:lambda a,b:a*b, ast.Div:lambda a,b:a/b}
OPS = {"analyze","differentiate","integrate","solve"}


def parse_expression(source: str):
    if not isinstance(source, str) or not (1 <= len(source.strip()) <= 160):
        raise ValueError("Expressão deve ter entre 1 e 160 caracteres.")
    normalized = source.replace("²","**2").replace("³","**3").replace("^","**").replace("π","pi").replace("sen(","sin(").replace("√","sqrt")
    try:
        tree = ast.parse(normalized, mode="eval")
    except SyntaxError as exc:
        raise ValueError("Expressão matemática inválida.") from exc
    if sum(1 for _ in ast.walk(tree)) > 65:
        raise ValueError("Expressão muito complexa.")

    def visit(node):
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int,float):
            if not math.isfinite(node.value) or abs(node.value)>1_000_000:
                raise ValueError("Constante fora dos limites.")
            return sp.sympify(node.value)
        if isinstance(node, ast.Name) and node.id in NAMES:
            return NAMES[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op,(ast.UAdd,ast.USub)):
            v=visit(node.operand)
            return v if isinstance(node.op,ast.UAdd) else -v
        if isinstance(node, ast.BinOp) and type(node.op) in OPERATORS:
            return OPERATORS[type(node.op)](visit(node.left),visit(node.right))
        if isinstance(node, ast.BinOp) and isinstance(node.op,ast.Pow):
            if not isinstance(node.right,ast.Constant) or type(node.right.value) not in (int,float) or abs(node.right.value)>8:
                raise ValueError("Expoente limitado ao intervalo -8 a 8.")
            return visit(node.left)**visit(node.right)
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id in FUNCTIONS and len(node.args)==1 and not node.keywords:
            return FUNCTIONS[node.func.id](visit(node.args[0]))
        raise ValueError("Símbolo ou operação não permitida na expressão.")
    value=visit(tree)
    if value.has(sp.zoo,sp.nan):
        raise ValueError("Expressão indefinida.")
    return value


def _real_float(value):
    try:
        evaluated=complex(sp.N(value,14))
        if abs(evaluated.imag)>1e-9 or not math.isfinite(evaluated.real):
            return None
        return float(evaluated.real)
    except (TypeError,ValueError,OverflowError,ZeroDivisionError):
        return None


def _bounds(request):
    def finite(name,default):
        raw=request.get(name,default)
        if isinstance(raw,bool):
            raise ValueError("Intervalo inválido.")
        try:
            result=float(raw)
        except (TypeError,ValueError) as exc:
            raise ValueError("Intervalo inválido.") from exc
        if not math.isfinite(result) or abs(result)>100_000:
            raise ValueError("Intervalo fora dos limites.")
        return result
    lo=finite("lower",-5)
    hi=finite("upper",5)
    if lo >= hi or hi-lo>200_000:
        raise ValueError("Informe limites crescentes.")
    return lo,hi


def calculate(request: dict):
    if not isinstance(request,dict):
        raise ValueError("Requisição inválida.")
    operation=request.get("operation","analyze")
    if operation not in OPS:
        raise ValueError("Operação não suportada.")
    expr=parse_expression(request.get("expression",""))
    lo,hi=_bounds(request)
    derivative=sp.diff(expr,X)
    symbolic_integral=None
    warnings=[]
    result=expr
    numeric_result=None
    if operation=="differentiate":
        result=derivative
    elif operation=="integrate":
        result=sp.integrate(expr,(X,lo,hi))
        numeric_result=_real_float(result)
    elif operation=="solve":
        result=sp.solveset(expr,X,domain=sp.Interval(lo,hi))
    if operation!="integrate":
        try:
            symbolic_integral=sp.integrate(expr,X)
        except Exception:
            warnings.append("Primitiva simbólica não determinada.")
    critical=[]
    try:
        candidates=sp.solve(sp.Eq(derivative,0),X)
        for item in candidates[:16]:
            x=_real_float(item)
            if x is not None and lo<=x<=hi:
                y=_real_float(expr.subs(X,item))
                if y is not None:
                    critical.append({"x":x,"y":y})
    except (TypeError, ValueError, NotImplementedError):
        warnings.append("Extremos não determinados analiticamente.")
    if operation=="solve":
        solutions=[]
        if isinstance(result,sp.FiniteSet):
            for item in list(result)[:20]:
                value=_real_float(item)
                if value is not None:
                    solutions.append(value)
    else:
        solutions=[]
    sampled=expr if operation!="differentiate" else derivative
    points=[]
    for index in range(61):
        x=lo+(hi-lo)*index/60
        try:
            y=_real_float(sampled.subs(X,x))
        except (TypeError,ValueError,ZeroDivisionError,OverflowError):
            y=None
        points.append({"x":round(x,10),"y":y})
    return {
        "operation":operation,"expression":str(expr),"expression_latex":sp.latex(expr),
        "expression_pretty":sp.pretty(expr,use_unicode=True),
        "derivative":str(derivative),"derivative_pretty":sp.pretty(derivative,use_unicode=True),
        "integral":str(symbolic_integral) if symbolic_integral is not None else None,
        "result":str(result),"result_pretty":sp.pretty(result,use_unicode=True),
        "numeric_result":numeric_result,"critical_points":critical,
        "solutions":solutions,"points":points,"interval":{"lower":lo,"upper":hi},
        "warnings":warnings,"status":"estudo_matematico_sem_verificacao_normativa",
        "engine":"SymPy local"
    }


def main(argv=None):
    try:
        raw=sys.stdin.read(2049)
        if len(raw)>2048:
            raise ValueError("Solicitação excede 2 KiB.")
        print(json.dumps(calculate(json.loads(raw)),ensure_ascii=False,allow_nan=False))
        return 0
    except (ValueError,TypeError,KeyError,json.JSONDecodeError) as exc:
        print(str(exc),file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
