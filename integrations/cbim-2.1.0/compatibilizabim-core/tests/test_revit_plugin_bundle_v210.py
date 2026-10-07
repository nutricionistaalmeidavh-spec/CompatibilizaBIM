from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
PLUGINS = ROOT / "revit-plugins"


def test_revit_bundle_contains_separate_cbim_and_hydraulic_addins_plus_library_contract():
    required = [
        PLUGINS / "CBIM.Revit.Contracts" / "CBIM.Revit.Contracts.csproj",
        PLUGINS / "CBIM.Revit.Contracts" / "Models.cs",
        PLUGINS / "CBIM.Revit.Plugin" / "CBIM.Revit.Plugin.csproj",
        PLUGINS / "CBIM.Revit.Plugin" / "App.cs",
        PLUGINS / "CBIM.Revit.Plugin" / "BuildPlanExecutor.cs",
        PLUGINS / "CBIM.Revit.Plugin" / "CBIM.Revit.Plugin.addin",
        PLUGINS / "CBIM.Library.Contract" / "CBIM.Library.Contract.csproj",
        PLUGINS / "CBIM.Library.Contract" / "LibraryBridge.cs",
        PLUGINS / "CBIM.Hydraulic.Plugin" / "CBIM.Hydraulic.Plugin.csproj",
        PLUGINS / "CBIM.Hydraulic.Plugin" / "App.cs",
        PLUGINS / "CBIM.Hydraulic.Plugin" / "NativeMepBuilder.cs",
        PLUGINS / "CBIM.Hydraulic.Plugin" / "CBIM.Hydraulic.Plugin.addin",
        PLUGINS / "build_revit_2027.ps1",
        PLUGINS / "install_revit_2027.ps1",
        PLUGINS / "uninstall_revit_2027.ps1",
        PLUGINS / "library-manifest.example.json",
    ]
    assert all(path.exists() for path in required), [str(p) for p in required if not p.exists()]


def test_revit_projects_target_net10_and_reference_local_revit_2027_api_only_in_hosts():
    contracts = (PLUGINS / "CBIM.Revit.Contracts" / "CBIM.Revit.Contracts.csproj").read_text(encoding="utf-8")
    assert "net10.0-windows" in contracts
    assert "RevitAPI" not in contracts

    for project in ("CBIM.Revit.Plugin", "CBIM.Hydraulic.Plugin"):
        text = (PLUGINS / project / f"{project}.csproj").read_text(encoding="utf-8")
        assert "net10.0-windows" in text
        assert "$(RevitInstallDir)\\RevitAPI.dll" in text
        assert "$(RevitInstallDir)\\RevitAPIUI.dll" in text
        assert "CBIM.Revit.Contracts" in text


def test_addin_manifests_are_valid_xml_and_have_distinct_ids():
    manifests = [
        PLUGINS / "CBIM.Revit.Plugin" / "CBIM.Revit.Plugin.addin",
        PLUGINS / "CBIM.Hydraulic.Plugin" / "CBIM.Hydraulic.Plugin.addin",
    ]
    ids = []
    for path in manifests:
        root = ET.parse(path).getroot()
        addin = root.find("AddIn")
        assert addin is not None and addin.attrib["Type"] == "Application"
        ids.append(addin.findtext("AddInId"))
        assert addin.findtext("Assembly")
        assert addin.findtext("FullClassName")
    assert len(set(ids)) == len(ids)


def test_cbim_host_source_exposes_import_analyze_reconstruct_review_and_library_manifest_bridge():
    app = (PLUGINS / "CBIM.Revit.Plugin" / "App.cs").read_text(encoding="utf-8")
    executor = (PLUGINS / "CBIM.Revit.Plugin" / "BuildPlanExecutor.cs").read_text(encoding="utf-8")
    bridge = (PLUGINS / "CBIM.Library.Contract" / "LibraryBridge.cs").read_text(encoding="utf-8")
    assert all(label in app for label in [r"Importar\nDWG", "Analisar", "Reconstruir", "Revisar"])
    assert "CBIM_ID" in executor
    assert "create_wall" in executor and "create_floor" in executor
    assert "manifest.json" in bridge
    assert "LocalApplicationData" in bridge


def test_hydraulic_host_uses_native_revit_connectors_and_fitting_factory_calls():
    source = (PLUGINS / "CBIM.Hydraulic.Plugin" / "NativeMepBuilder.cs").read_text(encoding="utf-8")
    assert "Connector" in source
    assert "NewElbowFitting" in source
    assert "NewTeeFitting" in source
    assert "NewCrossFitting" in source
    assert "NewTransitionFitting" in source
    assert "Pipe.Create" in source


def test_installer_uses_revit_2027_addins_directory_and_keeps_plugins_separate():
    text = (PLUGINS / "install_revit_2027.ps1").read_text(encoding="utf-8")
    assert "Autodesk\\Revit\\Addins\\2027" in text
    assert "CBIM.Revit.Plugin" in text
    assert "CBIM.Hydraulic.Plugin" in text
    assert "CBIM.Library.Contract" in text


def test_generic_cbim_host_does_not_create_native_mep_owned_by_hydraulic_plugin():
    executor = (PLUGINS / "CBIM.Revit.Plugin" / "BuildPlanExecutor.cs").read_text(encoding="utf-8")
    assert 'operation.Action is "create_pipe" or "create_fitting"' in executor
    assert 'CreatePipe(operation)' not in executor
    assert 'Pipe.Create(' not in executor


def test_bundle_installs_core_cli_and_acadsharp_bridge_for_revit_host():
    installer = PLUGINS / "install_core_windows.ps1"
    assert installer.exists()
    text = installer.read_text(encoding="utf-8")
    assert "CBIM_REVIT_CLI" in text
    assert "CBIM_ACADSHARP_BRIDGE" in text
    assert "dwg-acadsharp-bridge" in text
    state = (PLUGINS / "CBIM.Revit.Plugin" / "PluginState.cs").read_text(encoding="utf-8")
    assert '"CBIM", "Revit", "2027", "Core", "cbim-revit.cmd"' in state


def test_revit_installer_bootstraps_core_cli_before_addins():
    installer = (PLUGINS / "install_revit_2027.ps1").read_text(encoding="utf-8")
    assert "install_core_windows.ps1" in installer


def test_hydraulic_plugin_can_continue_from_latest_cbim_core_plan_without_manual_file_pick():
    state = (PLUGINS / "CBIM.Hydraulic.Plugin" / "HydraulicState.cs").read_text(encoding="utf-8")
    refine = (PLUGINS / "CBIM.Hydraulic.Plugin" / "Commands" / "RefineHydraulicCommand.cs").read_text(encoding="utf-8")
    assert "FindLatestCorePlan" in state
    assert '"CBIM", "Revit", "2027", "Work"' in state
    assert "HydraulicState.FindLatestCorePlan()" in refine


def test_library_bridge_loads_default_manifest_before_validating_pre_resolved_family_paths():
    bridge = (PLUGINS / "CBIM.Library.Contract" / "LibraryBridge.cs").read_text(encoding="utf-8")
    load_pos = bridge.index("manifest ??= TryLoadDefaultManifest();")
    resolved_pos = bridge.index("operation.ResolvedFamily")
    assert load_pos < resolved_pos


def test_revit_build_script_prefers_64bit_dotnet_sdk_path():
    text = (PLUGINS / "build_revit_2027.ps1").read_text(encoding="utf-8")
    assert 'C:\\Program Files\\dotnet\\dotnet.exe' in text


def test_core_installer_installs_bundled_cbim_sdk_before_core_wheel():
    text = (PLUGINS / "install_core_windows.ps1").read_text(encoding="utf-8")
    assert "cbim_sdk-*.whl" in text
    sdk_install = text.index("$venvPip install --no-deps --upgrade --force-reinstall $sdkWheel.FullName")
    core_install = text.index("$venvPip install --upgrade --force-reinstall $CoreWheel")
    assert sdk_install < core_install


def test_core_installer_can_build_missing_wheel_without_python_build_package():
    text = (PLUGINS / "install_core_windows.ps1").read_text(encoding="utf-8")
    assert "-m pip wheel" in text
    assert "-m build --wheel" not in text
