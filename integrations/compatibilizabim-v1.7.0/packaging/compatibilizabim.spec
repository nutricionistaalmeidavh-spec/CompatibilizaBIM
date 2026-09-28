# PyInstaller spec for the local CompatibilizaBIM desktop launcher.
from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = collect_all('ifcopenshell')
reportlab_datas, reportlab_binaries, reportlab_hidden = collect_all('reportlab')
datas += reportlab_datas
binaries += reportlab_binaries
hiddenimports += reportlab_hidden

a = Analysis(
    ['src/compatibilizabim/desktop_cli.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='CompatibilizaBIM',
    console=True,
    onefile=True,
)
