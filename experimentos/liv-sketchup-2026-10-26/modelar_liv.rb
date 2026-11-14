# Componentes nativos a partir da geometria do LIV efetivamente publicado.
require 'json'

module LIVSketchUp
  ROOT = File.dirname(__FILE__) unless const_defined?(:ROOT)

  def self.point(v)
    Geom::Point3d.new(v[0].m, -v[2].m, v[1].m)
  end

  def self.transform(a)
    Geom::Transformation.new([
      a[0], -a[2], a[1], 0, -a[8], a[10], -a[9], 0,
      a[4], -a[6], a[5], 0, a[12].m, -a[14].m, a[13].m, 1
    ])
  end

  def self.init
    @model = Sketchup.active_model
    @datasets ||= {}
    @defs ||= {}
    @done ||= {}
    @stats ||= {faces: 0, instances: 0, definitions: 0, errors: []}
    @ext_tag = @model.layers.add('LIV | Condominio completo')
    @apt_tag = @model.layers.add('LIV | Apartamento decorado 47,59 m2')
    @ceiling_tag = @model.layers.add('LIV | Teto do apartamento')
    @furniture_tag = @model.layers.add('LIV | Mobilia publicada')
    @warehouse_tag = @model.layers.add('LIV | Moveis 3D Warehouse')
    @ext = @model.entities.add_group unless @ext&.valid?
    @ext.name = 'LIV Ipanema | Condominio publicado'
    @ext.layer = @ext_tag
    @apt = @model.entities.add_group unless @apt&.valid?
    @apt.name = 'LIV Ipanema | Apartamento canto 47,59 m2'
    @apt.layer = @apt_tag
    @ext.set_attribute('LIV', 'referencia', 'https://conectaimoveis3d.com.br/maquetes/liv/')
    @ext.set_attribute('LIV', 'geometria', 'entrada/candidato | versao publicada')
    @apt.set_attribute('LIV', 'area_util_m2', 47.59)
    @model.set_attribute('LIV', 'observacao', 'Replica da maquete publicada. Medidas inferidas da fonte ilustrativa, sem projeto executivo.')
    @model.entities.each { |e| e.hidden = true if e != @ext && e != @apt && e.respond_to?(:hidden=) }
    units = @model.options['UnitsOptions']
    units['LengthUnit'] = 4
    units['LengthPrecision'] = 2
    @apt_tag.visible = false
    @ceiling_tag.visible = false
    @ext_tag.visible = true
    @model.active_view.invalidate
    {sketchup: Sketchup.version, rendering: @model.rendering_options.to_a.select { |k, _| k =~ /Ambient|Render|Texture|Edge/ }, stats: @stats}
  end

  def self.dataset(name)
    @datasets[name] ||= JSON.parse(File.read(File.join(ROOT, 'dados', name + '.json'), encoding: 'UTF-8'))
  end

  def self.material(name, id)
    spec = dataset(name)['materials'][id]
    @materials ||= {}
    key = name + '/' + id
    return @materials[key] if @materials[key]&.valid?
    mat = @model.materials.add('LIV | ' + spec['name'])
    mat.color = Sketchup::Color.new(*spec['color'])
    if spec['texture'] && File.file?(spec['texture']['path'])
      mat.texture = [spec['texture']['path'], 1.m, 1.m]
      if spec['color'] != [255, 255, 255] && !name.start_with?('warehouse-')
        mat.color = Sketchup::Color.new(*spec['color'])
      end
    end
    mat.alpha = spec['opacity']
    if mat.respond_to?(:workflow=)
      mat.workflow = Sketchup::Material::WORKFLOW_PBR_METALLIC_ROUGHNESS
      mat.roughness_factor = spec['roughness']
      mat.metallic_factor = spec['metalness']
      mat.roughness_enabled = true
      mat.metalness_enabled = true
      if spec['normal'] && File.file?(spec['normal']['path'])
        mat.normal_texture = spec['normal']['path']
        mat.normal_enabled = true
        mat.normal_scale = 0.12
      end
    end
    @materials[key] = mat
  end

  def self.definition(name, item)
    key = [name, item['geometry'], item['material']].join('/')
    return @defs[key] if @defs[key]&.valid?
    spec = dataset(name)['geometries'][item['geometry']]
    mat = material(name, item['material'])
    positions = spec['position']
    indices = spec['index'] || (0...positions.length / 3).to_a
    mesh = Geom::PolygonMesh.new(positions.length / 3, indices.length / 3)
    vertex_map = []
    texture = dataset(name)['materials'][item['material']]['texture']
    repeat = texture ? texture['repeat'] : [1, 1]
    offset = texture ? texture['offset'] : [0, 0]
    positions.each_slice(3).with_index do |v, i|
      n = mesh.add_point(point(v))
      vertex_map << n
      if texture && spec['uv']
        u = spec['uv'][i * 2] * repeat[0] + offset[0]
        v = spec['uv'][i * 2 + 1] * repeat[1] + offset[1]
        mesh.set_uv(n, Geom::Point3d.new(u, v, 1), true)
      end
    end
    indices.each_slice(3) do |tri|
      polygon = tri.map { |i| vertex_map[i] }
      mesh.add_polygon(polygon) if polygon.uniq.length == 3
    end
    definition = @model.definitions.add('LIV | ' + item['name'].to_s.gsub('Blender / ', '').gsub('LIV contorno / ', ''))
    definition.description = 'Geometria editavel da versao publicada do LIV. Escala em metros preservada.'
    definition.entities.fill_from_mesh(mesh, true, 0, mat, mat)
    definition.entities.grep(Sketchup::Edge).each do |edge|
      if edge.faces.length == 2 && edge.faces[0].normal.dot(edge.faces[1].normal) > 0.5
        edge.soft = true
        edge.smooth = true
      end
    end
    faces = definition.entities.grep(Sketchup::Face).length
    raise 'Malha vazia: ' + key if faces == 0 && indices.length > 0
    @stats[:faces] += faces
    @stats[:definitions] += 1
    @defs[key] = definition
  end

  def self.build(name, first, count)
    started = Time.now
    @model.start_operation('LIV | ' + name + ' | lote ' + first.to_s, true)
    objects = dataset(name)['objects']
    if name == 'apartamento' && !@apt&.valid?
      @apt = @model.entities.add_group
      @apt.name = 'LIV Ipanema | Apartamento canto 47,59 m2'
      @apt.layer = @apt_tag
      @apt.set_attribute('LIV', 'area_util_m2', 47.59)
    end
    root = name == 'exterior' ? @ext : @apt
    objects[first, count].to_a.each_with_index do |item, local|
      index = first + local
      key = name + '/' + index.to_s
      next if @done[key]
      definition = definition(name, item)
      world = transform(item['matrix'])
      matrices = item['instances']
      matrices = [nil] unless matrices
      matrices.each_with_index do |matrix, i|
        tr = matrix ? world * transform(matrix) : world
        instance = root.entities.add_instance(definition, tr)
        instance.name = item['name'] + (matrices.length > 1 ? ' | ' + (i + 1).to_s : '')
        instance.set_attribute('LIV', 'source_slot', item['slot'] || index)
        if name == 'apartamento'
          instance.layer = @ceiling_tag if item['ceiling']
          instance.layer = @furniture_tag if item['slot'] && item['slot'] >= 49
        end
        @stats[:instances] += 1
      end
      @done[key] = true
    end
    @model.commit_operation
    @model.active_view.invalidate
    {dataset: name, built: @done.keys.count { |k| k.start_with?(name + '/') }, total: objects.length,
     seconds: (Time.now - started).round(2), stats: @stats}
  rescue StandardError => e
    @model.abort_operation
    @stats[:errors] << [e.class.to_s, e.message]
    raise
  end

  def self.exterior_camera(view = 'perspectiva')
    spec = dataset('exterior')['views'][view] || dataset('exterior')['camera']
    camera = Sketchup::Camera.new(point(spec['position']), point(spec['target']), Z_AXIS)
    camera.fov = spec['fov']
    @model.active_view.camera = camera
  end

  def self.show(mode)
    @ext_tag.visible = mode == 'exterior'
    @apt_tag.visible = mode != 'exterior'
    @ceiling_tag.visible = mode == 'tour'
    if @apt&.valid? && @section&.valid?
      @apt.entities.active_section_plane = mode == 'apartamento' ? @section : nil
    end
    @model.shadow_info['UseSunForAllShading'] = mode == 'exterior'
    @model.shadow_info['DisplayShadows'] = mode == 'exterior'
    if mode == 'exterior'
      exterior_camera
    elsif mode == 'apartamento'
      @model.active_view.camera = Sketchup::Camera.new([9.m, -12.m, 17.m], [0, 0, 0.5.m], Z_AXIS, false)
      @model.active_view.camera.height = 9.8.m
    end
    @model.active_view.invalidate
    {mode: mode, stats: @stats}
  end

  def self.save
    path = File.join(ROOT, 'entrega', 'LIV_Ipanema_Conecta.skp')
    Dir.mkdir(File.dirname(path)) unless Dir.exist?(File.dirname(path))
    raise 'Nao foi possivel salvar' unless @model.save(path)
    {path: path, bytes: File.size(path), stats: @stats}
  end
end

$liv_result = LIVSketchUp.init
