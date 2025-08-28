-- justify-filter.lua
-- Pandoc Lua filter to add Word-compatible paragraph justification

function Para(para)
  if FORMAT == "docx" then
    -- Add DOCX-specific attributes for justification
    if not para.attr then
      para.attr = pandoc.Attr()
    end
    
    -- Use Word's built-in paragraph properties
    para.attr.attributes["w:jc"] = "both"  -- Word justification property
    para.attr.attributes["w:spacing"] = "w:after='240'"  -- 12pt spacing after
    para.attr.attributes["w:lineRule"] = "auto"
    
    return para
  end
  return para
end

-- Alternative approach: use raw Word XML
function Pandoc(doc)
  if FORMAT == "docx" then
    -- Add custom Word XML for paragraph properties
    local raw_xml = pandoc.RawBlock("openxml", 
      [[<w:pPr>
        <w:jc w:val="both"/>
        <w:spacing w:after="240"/>
      </w:pPr>]])
    
    -- This approach would require more complex document manipulation
    return doc
  end
  return doc
end