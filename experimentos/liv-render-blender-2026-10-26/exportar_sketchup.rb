require 'json'
require 'fileutils'

module LIVRenderExport
  ROOT = File.dirname(__FILE__) unless const_defined?(:ROOT)

  def self.material_record(mat, index, textures)
    color = mat.color
    record = {name: mat.name, color: [color.red, color.green, color.blue], alpha: mat.alpha}
    record[:workflow] = mat.workflow if mat.respond_to?(:workflow)
    record[:metalness_enabled] = mat.metalness_enabled? if mat.respond_to?(:metalness_enabled?)
    record[:roughness_enabled] = mat.roughness_enabled? if mat.respond_to?(:roughness_enabled?)
    {roughness: :roughness_factor, metallic: :metallic_factor, normal_scale: :normal_scale,
     normal_style: :normal_style}.each do |key, method|
      record[key] = mat.public_send(method) if mat.respond_to?(method)
    end
    {color_map: :texture, normal_map: :normal_texture, roughness_map: :roughness_texture,
     metallic_map: :metallic_texture, ao_map: :ao_texture}.each do |key, method|
      next unless mat.respond_to?(method)
      texture = mat.public_send(method)
      next unless texture
      path = File.join(textures, "material-#{index}-#{key}.png")
      raise 'Falha ao exportar textura ' + mat.name unless texture.write(path, key == :color_map)
      record[key] = path
    end
    record
  end

  def self.geometry(definition, material_ids)
    points, normals, uvs, triangles, materials = [], [], [], [], []
    definition.entities.grep(Sketchup::Face).each do |face|
      mesh = face.mesh(7)
      offset = points.length / 3
      mesh.points.each_with_index do |p, i|
        points.concat([p.x.to_m, p.y.to_m, p.z.to_m])
        n = mesh.normal_at(i + 1) || face.normal
        normals.concat(n.to_a)
        uv = mesh.uv_at(i + 1, true)
        uvs.concat(uv && uv.z.abs > 1e-10 ? [uv.x / uv.z, uv.y / uv.z] : [0, 0])
      end
      mesh.polygons.each do |polygon|
        ids = polygon.map { |i| offset + i.abs - 1 }
        (1...ids.length - 1).each do |i|
          triangles.concat([ids[0], ids[i], ids[i + 1]])
          materials << (face.material ? material_ids[face.material.object_id] : nil)
        end
      end
    end
    {name: definition.name, points: points, normals: normals, uv: uvs, triangles: triangles, materials: materials}
  end

  def self.walk(entities, transform, category, records, definitions, material_ids, inherited_role = nil)
    entities.each do |instance|
      next unless instance.is_a?(Sketchup::ComponentInstance) || instance.is_a?(Sketchup::Group)
      next if instance.hidden?
      definition = instance.definition
      key = definition.guid
      role = instance.layer.name.include?('Teto') ? 'ceiling' : inherited_role
      definitions[key] ||= geometry(definition, material_ids)
      tr = transform * instance.transformation
      unless definitions[key][:triangles].empty?
        matrix = tr.to_a
        [12, 13, 14].each { |i| matrix[i] = matrix[i].to_m }
        records << {name: instance.name.empty? ? definition.name : instance.name,
                    geometry: key, matrix: matrix, category: category, role: role,
                    source_slot: instance.get_attribute('LIV', 'source_slot')}
      end
      walk(definition.entities, tr, category, records, definitions, material_ids, role)
    end
  end

  def self.run
    model = Sketchup.active_model
    raise 'Abra o arquivo LIV_Ipanema_Conecta.skp' unless File.basename(model.path) == 'LIV_Ipanema_Conecta.skp'
    sources = File.join(ROOT, 'fontes')
    textures = File.join(sources, 'texturas')
    FileUtils.mkdir_p(textures)
    material_ids = {}
    materials = {}
    model.materials.each_with_index do |mat, i|
      material_ids[mat.object_id] = i
      materials[i] = material_record(mat, i, textures)
    end
    definitions, records = {}, []
    model.entities.grep(Sketchup::Group).each do |root|
      next unless root.name.start_with?('LIV Ipanema |')
      category = root.name.include?('Condominio') ? 'exterior' : 'apartamento'
      walk(root.entities, root.transformation, category, records, definitions, material_ids)
    end
    raise 'Faltou geometria de uma das cenas' unless records.map { |r| r[:category] }.uniq.length == 2
    payload = {source: model.path, units: 'm', axes: 'SketchUp Z-up', materials: materials,
               geometries: definitions.reject { |_, g| g[:triangles].empty? }, objects: records,
               scenes: model.pages.map(&:name)}
    path = File.join(sources, 'liv-sketchup.json')
    File.write(path, JSON.generate(payload))
    {path: path, bytes: File.size(path), definitions: payload[:geometries].length,
     objects: records.length, materials: materials.length,
     textured: materials.values.count { |m| m[:color_map] }}
  end
end

$liv_result = LIVRenderExport.run
