require 'json'

module LIVSketchUp
  def self.presentation
    model = @model
    model.start_operation('LIV | Materiais e apresentacao', true)
    options = model.rendering_options
    model.options['PageOptions']['ShowTransition'] = false
    model.options['PageOptions']['TransitionTime'] = 0.0
    values = {
      'BackgroundColor' => Sketchup::Color.new(241, 239, 233),
      'DrawGround' => false, 'DrawHorizon' => false, 'DisplaySketchAxes' => false,
      'EdgeDisplayMode' => 0, 'DrawSilhouettes' => false, 'DrawProfilesOnly' => false,
      'DrawLineEnds' => false, 'DrawBackEdges' => false, 'Texture' => true,
      'AmbientOcclusion' => true, 'AmbientOcclusionDistance' => 1.0.m,
      'AmbientOcclusionIntensity' => 0.35, 'AmbientOcclusionMultiplier' => 1.0,
      'DisplaySectionPlanes' => false,
      'SectionDefaultFillColor' => Sketchup::Color.new(210, 204, 191),
      'SectionDefaultCutColor' => Sketchup::Color.new(165, 157, 141),
      'SectionCutWidth' => 1, 'SectionCutDrawEdges' => false
    }
    values.each { |key, value| options[key] = value if options.keys.include?(key) }
    library = 'C:/Program Files/SketchUp/SketchUp 2026/SketchUp/ShippedExtensions/su_assistant/rb/materials/'
    mappings = {
      'm2' => ['Wood Floor Light.skm', 'LIV | SketchUp - Carvalho claro'],
      'm1' => ['Marble Carrara Floor Tile.skm', 'LIV | SketchUp - Carrara acetinado'],
      'm12' => ['Wood Veneer 01.skm', 'LIV | SketchUp - Marcenaria em madeira']
    }
    @native_materials ||= {}
    mappings.each do |key, entry|
      unless @native_materials[key]&.valid?
        mat = model.materials.load(File.join(library, entry[0]))
        mat.name = entry[1]
        mat.set_attribute('LIV', 'origem', 'Biblioteca oficial instalada do SketchUp 2026: ' + entry[0])
        @native_materials[key] = mat
      end
      dataset('apartamento')['objects'].each do |object|
        next unless object['material'] == key
        definition_key = ['apartamento', object['geometry'], key].join('/')
        definition = @defs[definition_key]
        next unless definition&.valid?
        definition.entities.grep(Sketchup::Face).each do |face|
          face.material = @native_materials[key]
          face.back_material = @native_materials[key]
        end
      end
    end
    shadow = model.shadow_info
    shadow['UseSunForAllShading'] = true
    shadow['DisplayShadows'] = true
    shadow['Light'] = 75
    shadow['Dark'] = 55
    shadow['Latitude'] = -22.0
    shadow['Longitude'] = -47.9
    shadow['ShadowTime'] = Time.local(2026, 10, 26, 10, 30, 0)
    model.styles.selected_style.name = 'LIV | Materiais, sombras e oclusao'
    model.styles.update_selected_style
    unless @section&.valid?
      @section = @apt.entities.add_section_plane([0, 0, 1.35.m], Geom::Vector3d.new(0, 0, -1))
      @section.name = 'LIV | Corte de apresentacao a 1,35 m'
      @section.symbol = 'A'
    end
    @section.set_plane([0, 0, -1, 1.15.m])
    @section.name = 'LIV | Corte de apresentacao a 1,15 m'
    options['DisplaySectionCuts'] = true
    options['SectionCutFilled'] = true
    model.styles.update_selected_style
    model.commit_operation
    show('exterior')
    model.active_view.refresh
    {native_materials: @native_materials.values.map(&:name), render: values.keys,
     exterior_instances: @ext.entities.length, apartment_instances: @apt.entities.length}
  rescue StandardError
    model.abort_operation
    raise
  end

  def self.scene(name, mode, eye = nil, target = nil, orthographic = false)
    show(mode)
    if eye
      camera = Sketchup::Camera.new(point(eye), point(target), orthographic ? Y_AXIS : Z_AXIS, !orthographic)
      if orthographic
        camera.height = 9.0.m
      else
        camera.fov = 65
      end
      @model.active_view.camera = camera
    end
    page = @model.pages.find { |p| p.name == name } || @model.pages.add(name)
    page.use_camera = true
    page.use_hidden_layers = true
    page.use_rendering_options = true
    page.use_shadow_info = true
    page.use_section_planes = true if page.respond_to?(:use_section_planes=)
    page.update
    page
  end

  def self.scenes
    scene('01 | LIV - Condominio completo', 'exterior')
    show('exterior')
    exterior_camera('aerea')
    page = @model.pages.find { |p| p.name == '02 | Implantacao e lazer' } || @model.pages.add('02 | Implantacao e lazer')
    page.use_hidden_layers = true
    page.update
    scene('03 | Apartamento decorado - 47,59 m2', 'apartamento')
    scene('04 | Planta do apartamento', 'apartamento', [0, 18, 0.001], [0, 0, 0], true)
    scene('05 | Sala e jantar', 'tour', [0.15, 1.55, 2.55], [2.5, 1.2, -0.5])
    scene('06 | Suite', 'tour', [-3.72, 1.5, 0.55], [-2.3, 0.85, -1.2])
    @model.pages.selected_page = @model.pages[0]
    show('exterior')
    save.merge(scenes: @model.pages.map(&:name))
  end

  def self.check
    ext_data = dataset('exterior')
    ext_expected = ext_data['objects'].sum { |o| o['instances'] ? o['instances'].length : 1 }
    raise 'Contagem exterior diferente' unless @ext.entities.length == ext_expected
    source_instances = @apt.entities.grep(Sketchup::ComponentInstance).count { |i| !i.get_attribute('LIV', 'source_slot').nil? }
    raise 'Contagem apartamento diferente' unless source_instances == dataset('apartamento')['objects'].length
    ext_size = [@ext.bounds.width.to_m, @ext.bounds.height.to_m, @ext.bounds.depth.to_m]
    apt_bounds = Geom::BoundingBox.new
    @apt.entities.grep(Sketchup::ComponentInstance).each { |instance| apt_bounds.add(instance.bounds) }
    apt_size = [apt_bounds.width.to_m, apt_bounds.height.to_m, apt_bounds.depth.to_m]
    raise 'Escala do apartamento fora do esperado' unless (8.4..8.9).cover?(apt_size[0]) && (2.6..2.9).cover?(apt_size[2])
    {exterior_instances: @ext.entities.length, apartment_instances: @apt.entities.length,
     exterior_bounds_m: ext_size, apartment_bounds_m: apt_size,
     native_materials: @native_materials.values.map(&:name), file: @model.path}
  end
end

$liv_result = LIVSketchUp.presentation
