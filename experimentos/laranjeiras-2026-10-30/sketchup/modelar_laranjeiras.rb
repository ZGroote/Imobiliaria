# Parque das Laranjeiras no SketchUp: componentes nativos a partir de modelo/modelo.json.
# Mesmo caminho da entrega do LIV (liv-sketchup-2026-10-26/modelar_liv.rb), mas pelo modelo com instâncias:
# cada geometria vira UMA definição e cada pavimento/torre é uma instância dela (editar um andar edita todos).
# Uso pela ponte MCP: load 'modelar_laranjeiras.rb'; Laranjeiras.init; Laranjeiras.build(0, 20) ...
require 'json'

module Laranjeiras
  ROOT = File.dirname(__FILE__) unless const_defined?(:ROOT)
  MODELO = File.join(ROOT, '..', 'modelo', 'modelo.json') unless const_defined?(:MODELO)

  # Web (x, y para cima, z) -> SketchUp (x, -z, y), em metros.
  def self.point(v)
    Geom::Point3d.new(v[0].m, -v[2].m, v[1].m)
  end

  def self.transform(a)
    Geom::Transformation.new([
      a[0], -a[2], a[1], 0, -a[8], a[10], -a[9], 0,
      a[4], -a[6], a[5], 0, a[12].m, -a[14].m, a[13].m, 1
    ])
  end

  def self.srgb(c)
    (255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c**(1 / 2.4) - 0.055)).round.clamp(0, 255)
  end

  def self.init
    @model = Sketchup.active_model
    @data = JSON.parse(File.read(MODELO, encoding: 'UTF-8'))
    @defs = {}
    @mats = {}
    @done = {}
    @stats = {faces: 0, instances: 0, definitions: 0}
    @site_tag = @model.layers.add('Laranjeiras | Implantacao')
    @tower_tags = @data['metadata']['torres_arq'].map { |t| @model.layers.add('Laranjeiras | ' + t['nome']) }
    @root = @model.entities.add_group
    @root.name = 'Parque das Laranjeiras | Condominio'
    @root.set_attribute('Laranjeiras', 'fonte', 'Book digital ADN; modelo de experimentos/laranjeiras-2026-10-30')
    @model.set_attribute('Laranjeiras', 'observacao',
                         'Reconstrucao ilustrativa pelo book (plantas, implantacao e renders). Medidas inferidas, sem projeto executivo.')
    units = @model.options['UnitsOptions']
    units['LengthUnit'] = 4
    units['LengthPrecision'] = 2
    {sketchup: Sketchup.version, groups: @data['groups'].length, geometries: @data['geometries'].length}
  end

  def self.material(id)
    return @mats[id] if @mats[id]&.valid?
    spec = @data['materials'][id]
    mat = @model.materials.add('Laranjeiras | ' + id.sub('MAT-', ''))
    mat.color = Sketchup::Color.new(*spec['color'].map { |c| srgb(c) })
    if mat.respond_to?(:workflow=)
      mat.workflow = Sketchup::Material::WORKFLOW_PBR_METALLIC_ROUGHNESS
      mat.roughness_factor = spec['roughness']
      mat.metallic_factor = spec['metalness']
      mat.roughness_enabled = true
      mat.metalness_enabled = true
    end
    mat.alpha = 0.45 if id.include?('vidro')
    @mats[id] = mat
  end

  def self.definition(group)
    key = group['geometry'] + '/' + group['material']
    return @defs[key] if @defs[key]&.valid?
    spec = @data['geometries'][group['geometry']]
    mat = material(group['material'])
    pos = spec['position']
    idx = spec['index']
    mesh = Geom::PolygonMesh.new(pos.length / 3, idx.length / 3)
    map = pos.each_slice(3).map { |v| mesh.add_point(point(v)) }
    idx.each_slice(3) do |tri|
      poly = tri.map { |i| map[i] }
      mesh.add_polygon(poly) if poly.uniq.length == 3
    end
    name = group['geometry'].sub('SITE-', 'implantacao-')
    definition = @model.definitions.add('Laranjeiras | ' + name)
    definition.entities.fill_from_mesh(mesh, true, 0, mat, mat)
    definition.entities.grep(Sketchup::Edge).each do |edge|
      if edge.faces.length == 2 && edge.faces[0].normal.dot(edge.faces[1].normal) > 0.5
        edge.soft = true
        edge.smooth = true
      end
    end
    @stats[:faces] += definition.entities.grep(Sketchup::Face).length
    @stats[:definitions] += 1
    @defs[key] = definition
  end

  # Constrói os grupos [first, first+count) do modelo; chamar em lotes pela ponte (cada chamada tem timeout).
  def self.build(first, count)
    started = Time.now
    @model.start_operation('Laranjeiras | lote ' + first.to_s, true)
    @data['groups'][first, count].to_a.each_with_index do |group, local|
      index = first + local
      next if @done[index]
      definition = definition(group)
      tower = group['tower']
      tag = tower >= 0 ? @tower_tags[tower] : @site_tag
      group['instances'].each do |inst|
        instance = @root.entities.add_instance(definition, transform(inst['matrix']))
        instance.layer = tag
        floor = inst['floor']
        instance.name = floor >= 0 ? format('Pavimento %02d', floor) : definition.name.sub('Laranjeiras | ', '')
        instance.set_attribute('Laranjeiras', 'papel', group['role'])
        @stats[:instances] += 1
      end
      @done[index] = true
    end
    @model.commit_operation
    @model.active_view.invalidate
    {built: @done.length, total: @data['groups'].length, seconds: (Time.now - started).round(2), stats: @stats}
  rescue StandardError
    @model.abort_operation
    raise
  end

  # Cenas: perspectiva, implantação vista de cima e a rua (Rua José Quatrochi fica no +y da web = -y no SketchUp).
  def self.scenes
    bounds = @root.bounds
    c = bounds.center
    d = bounds.diagonal
    shots = [
      ['01 Perspectiva', [c.x + 0.55 * d, c.y - 0.75 * d, c.z + 0.45 * d], c, false],
      ['02 Implantacao', [c.x, c.y, c.z + 2 * d], c, true],
      ['03 Rua Jose Quatrochi', [c.x - 0.1 * d, c.y - 0.85 * d, 1.7.m], [c.x, c.y, 18.m], false],
    ]
    shots.each do |name, eye, target, top|
      camera = Sketchup::Camera.new(eye, target, top ? Y_AXIS : Z_AXIS, !top)
      camera.height = d * 0.85 if top
      camera.fov = 40 unless top
      @model.active_view.camera = camera
      page = @model.pages[name] || @model.pages.add(name)
      page.update
    end
    @model.shadow_info['DisplayShadows'] = true
    @model.pages.selected_page = @model.pages['01 Perspectiva']
    {pages: @model.pages.map(&:name)}
  end

  # ---------- Apartamento decorado (cena real do interior, exportada por exportar_apartamentos.py) ----------
  AREA = {'canto' => '39,12', 'meio' => '40,79'} unless const_defined?(:AREA)

  def self.apartamento_init(tip, deslocamento_m)
    @model = Sketchup.active_model
    @apt ||= {}
    @apt_done ||= {}
    path = File.join(ROOT, 'dados', "apartamento-#{tip}.json")
    data = JSON.parse(File.read(path, encoding: 'UTF-8'))
    tag = @model.layers.add("Laranjeiras | Apartamento #{tip} #{AREA[tip]} m2")
    @ceiling_tag = @model.layers.add('Laranjeiras | Teto dos apartamentos')
    @ceiling_tag.visible = false
    group = @model.entities.add_group
    group.name = "Parque das Laranjeiras | Apartamento #{tip} #{AREA[tip]} m2 (decorado)"
    group.layer = tag
    # Ao lado do condomínio, no nível do chão: o apartamento é a planta de referência, não um final específico.
    group.transform!(Geom::Transformation.translation([deslocamento_m.m, 0, 0]))
    group.set_attribute('Laranjeiras', 'fonte', 'Cena do interior do site (FloorPlan + HouseMesh + moveis aprovados do LIV)')
    @apt[tip] = {data: data, group: group, defs: {}, mats: {}}
    {tipologia: tip, objetos: data['objects'].length, geometrias: data['geometries'].length}
  end

  def self.apt_material(tip, id)
    a = @apt[tip]
    return a[:mats][id] if a[:mats][id]&.valid?
    spec = a[:data]['materials'][id]
    mat = @model.materials.add("Laranjeiras #{tip} | #{spec['name']}")
    mat.color = Sketchup::Color.new(*spec['color'])
    if spec['texture'] && File.file?(spec['texture']['path'])
      mat.texture = [spec['texture']['path'], 1.m, 1.m]
      mat.color = Sketchup::Color.new(*spec['color']) if spec['color'] != [255, 255, 255]
    end
    mat.alpha = spec['opacity'] if spec['opacity'] < 1
    a[:mats][id] = mat
  end

  def self.apt_definition(tip, item)
    a = @apt[tip]
    key = item['geometry'] + '/' + item['material']
    return a[:defs][key] if a[:defs][key]&.valid?
    spec = a[:data]['geometries'][item['geometry']]
    mat = apt_material(tip, item['material'])
    pos = spec['position']
    idx = spec['index'] || (0...pos.length / 3).to_a
    texture = a[:data]['materials'][item['material']]['texture']
    rep = texture ? texture['repeat'] : [1, 1]
    off = texture ? texture['offset'] : [0, 0]
    mesh = Geom::PolygonMesh.new(pos.length / 3, idx.length / 3)
    map = []
    pos.each_slice(3).with_index do |v, i|
      n = mesh.add_point(point(v))
      map << n
      if texture && spec['uv'] && spec['uv'].length > i * 2 + 1
        mesh.set_uv(n, Geom::Point3d.new(spec['uv'][i * 2] * rep[0] + off[0], spec['uv'][i * 2 + 1] * rep[1] + off[1], 1), true)
      end
    end
    idx.each_slice(3) do |tri|
      poly = tri.map { |i| map[i] }
      mesh.add_polygon(poly) if poly.uniq.length == 3
    end
    definition = @model.definitions.add("Laranjeiras #{tip} | #{item['name']}")
    definition.entities.fill_from_mesh(mesh, true, 0, mat, mat)
    definition.entities.grep(Sketchup::Edge).each do |edge|
      if edge.faces.length == 2 && edge.faces[0].normal.dot(edge.faces[1].normal) > 0.5
        edge.soft = true
        edge.smooth = true
      end
    end
    a[:defs][key] = definition
  end

  def self.apartamento_build(tip, first, count)
    started = Time.now
    a = @apt[tip]
    @model.start_operation("Laranjeiras | apartamento #{tip} #{first}", true)
    a[:data]['objects'][first, count].to_a.each do |item|
      next if @apt_done["#{tip}/#{item['slot']}"]
      instance = a[:group].entities.add_instance(apt_definition(tip, item), transform(item['matrix']))
      instance.name = item['name']
      instance.layer = @ceiling_tag if item['ceiling']
      @apt_done["#{tip}/#{item['slot']}"] = true
    end
    @model.commit_operation
    {tipologia: tip, montados: @apt_done.keys.count { |k| k.start_with?(tip + '/') }, total: a[:data]['objects'].length,
     segundos: (Time.now - started).round(2)}
  rescue StandardError
    @model.abort_operation
    raise
  end

  # Planta decorada: corte a 1,15 m só dentro do apartamento, câmera de cima em perspectiva leve.
  def self.apartamento_cena(tip, numero)
    a = @apt[tip]
    group = a[:group]
    plane = group.entities.add_section_plane([group.bounds.center.x, group.bounds.center.y, 1.15.m], [0, 0, -1])
    plane.name = 'Corte 1,15 m'
    group.entities.active_section_plane = plane
    b = group.bounds
    c = b.center
    camera = Sketchup::Camera.new([c.x + 6.m, c.y - 9.m, 15.m], [c.x, c.y, 0.5.m], Z_AXIS, true)
    camera.fov = 45
    @model.active_view.camera = camera
    name = format('%02d Planta %s', numero, tip)
    page = @model.pages[name] || @model.pages.add(name)
    page.update
    {cena: name}
  end

  def self.save
    path = File.join(ROOT, 'entrega', 'Parque_das_Laranjeiras.skp')
    Dir.mkdir(File.dirname(path)) unless Dir.exist?(File.dirname(path))
    raise 'Nao foi possivel salvar' unless @model.save(path)
    {path: path, bytes: File.size(path), stats: @stats}
  end
end
