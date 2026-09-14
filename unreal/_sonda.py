import unreal
L = unreal.log_warning
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
L("SONDA les=%s" % ", ".join(sorted(m for m in dir(les) if not m.startswith("_"))))
L("SONDA gpulm=%s" % ", ".join(n for n in dir(unreal) if "GPULightmass" in n or "Lightmass" in n))
