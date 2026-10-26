require 'json'

module LIVSketchUp
  def self.warehouse_definition(asset)
    @warehouse_definitions ||= {}
    return @warehouse_definitions[asset] if @warehouse_definitions[asset]&.valid?
    name = 'warehouse-' + asset
    definition = @model.definitions.add('LIV | 3D Warehouse | ' + asset)
    dataset(name)['objects'].each do |object|
      child = definition(name, object)
      definition.entities.add_instance(child, transform(object['matrix']))
    end
    source = {
      'bed' => 'c8b399e7-a06f-487c-a410-2dec1b152945',
      'sofa' => '75a44b38-8544-4731-81ba-521828700e05',
      'chair' => '795a344b-4a53-42d3-93e7-066daadea63b'
    }[asset]
    definition.description = 'SketchUp Content Library. GLB publico convertido em geometria nativa editavel.'
    definition.set_attribute('LIV', 'origem', 'https://3dwarehouse.sketchup.com/model/' + source) if source
    @warehouse_definitions[asset] = definition
  end

  def self.place_warehouse(asset, furniture, slots)
    definition = warehouse_definition(asset)
    bounds = definition.bounds
    width = bounds.width.to_f
    depth = bounds.height.to_f
    height = bounds.depth.to_f
    swap = asset == 'bed' ? width > depth : depth > width
    turn = swap ? Geom::Transformation.rotation(ORIGIN, Z_AXIS, Math::PI / 2) : Geom::Transformation.new
    source_w, source_d = swap ? [depth, width] : [width, depth]
    normalize = Geom::Transformation.translation([-bounds.center.x, -bounds.center.y, -bounds.min.z])
    scale = Geom::Transformation.scaling(furniture['w'].m / source_w, furniture['d'].m / source_d,
                                         furniture['h'].m / height)
    angle = Geom::Transformation.rotation(ORIGIN, Z_AXIS, furniture.fetch('rot', 0) * Math::PI / 2)
    p = furniture['p']
    origin = Geom::Transformation.translation([(p[0] - 4.25).m, (3.125 - p[1]).m, 0.02.m])
    tr = origin * angle * scale * turn * normalize
    existing = @apt.entities.grep(Sketchup::ComponentInstance).find do |instance|
      instance.get_attribute('LIV', 'warehouse_name') == furniture['nome']
    end
    instance = existing || @apt.entities.add_instance(definition, tr)
    instance.transformation = tr
    instance.name = furniture['nome'] + ' | SketchUp Content Library'
    instance.layer = @warehouse_tag
    instance.set_attribute('LIV', 'warehouse_name', furniture['nome'])
    instance.set_attribute('LIV', 'medidas_m', [furniture['w'], furniture['d'], furniture['h']])
    @apt.entities.grep(Sketchup::ComponentInstance).each do |original|
      if slots.include?(original.get_attribute('LIV', 'source_slot'))
        original.hidden = true
        original.set_attribute('LIV', 'substituido_por', instance.name)
      end
    end
    {name: instance.name, source_bounds_m: [width, depth, height].map { |v| v.to_m },
     position_m: instance.bounds.center.to_a.map { |v| v.to_m }, target: [furniture['w'], furniture['d'], furniture['h']]}
  end

  def self.furnish
    unit = JSON.parse(File.read(File.join(ROOT, 'fontes', 'unidade.json'), encoding: 'UTF-8'))
    furniture = unit['planta']['moveis']
    @model.start_operation('LIV | Mobiliar com SketchUp Content Library', true)
    imported = []
    imported << place_warehouse('bed', furniture[0], [49, 50, 51, 52])
    imported << place_warehouse('bed', furniture[4], [56, 57, 58, 59])
    imported << place_warehouse('sofa', furniture[7], [62, 63, 64, 65])
    [[11, 70], [12, 71], [13, 72], [14, 73], [25, 88], [26, 89]].each do |index, slot|
      imported << place_warehouse('chair', furniture[index], [slot])
    end
    %w[bed sofa chair].each do |asset|
      data_name = 'warehouse-' + asset
      dataset(data_name)['materials'].each do |id, spec|
        next unless spec['texture']
        mat = material(data_name, id)
        mat.texture = nil
        mat.color = Sketchup::Color.new(255, 255, 255)
        mat.texture = [spec['texture']['path'], 1.m, 1.m]
      end
    end
    material('warehouse-bed', 'm2').color = Sketchup::Color.new(166, 190, 177)
    material('warehouse-sofa', 'm1').color = Sketchup::Color.new(154, 173, 181)
    material('warehouse-sofa', 'm2').color = Sketchup::Color.new(179, 194, 197)
    material('warehouse-chair', 'm1').color = Sketchup::Color.new(164, 135, 99)
    @model.commit_operation
    show('apartamento')
    @model.active_view.refresh
    save.merge(imported: imported)
  rescue StandardError
    @model.abort_operation
    raise
  end
end

$liv_result = LIVSketchUp.furnish
