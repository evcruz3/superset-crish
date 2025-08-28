-- justify-docx.lua
-- Pandoc Lua filter to justify paragraphs in DOCX output

function Para(para)
  if FORMAT == "docx" then
    -- Add justification attribute to paragraphs
    para.attr = pandoc.Attr("", {}, {["custom-style"] = "Body Text"})
    return para
  end
  return para
end

function Div(div)
  if FORMAT == "docx" then
    -- Handle div elements that contain paragraphs
    if div.classes:includes("justify") then
      div.attr = pandoc.Attr("", {}, {["custom-style"] = "Body Text"})
    end
    return div
  end
  return div
end