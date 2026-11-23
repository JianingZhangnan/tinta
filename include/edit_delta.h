#pragma once
#include <string>
#include <vector>
#include <cstddef>
namespace fpks {
struct TextDelta { size_t from=0,to=0; std::wstring insert; };
// Offsets are UTF-16 code units, exactly as in CodeMirror on Windows.
// Validate the entire transaction first so a bad range never partially edits.
inline bool applyDeltas(std::wstring& text,const std::vector<TextDelta>& changes){
    size_t end=text.size();
    for(auto i=changes.rbegin();i!=changes.rend();++i){if(i->from>i->to||i->to>end)return false;end=i->from;}
    for(auto i=changes.rbegin();i!=changes.rend();++i)text.replace(i->from,i->to-i->from,i->insert);
    return true;
}
}
