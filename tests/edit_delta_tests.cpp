#include "edit_delta.h"
#include <iostream>
int main(){
    int failures=0;
    auto check=[&](bool good){if(!good)++failures;};
    std::wstring text=L"alpha beta gamma";
    check(fpks::applyDeltas(text,{{0,5,L"A"},{11,16,L"G"}}));check(text==L"A beta G");
    const auto saved=text;
    check(!fpks::applyDeltas(text,{{0,1,L"bad"},{9,10,L"bad"}}));check(text==saved);
    check(!fpks::applyDeltas(text,{{0,4,L"bad"},{2,3,L"bad"}}));check(text==saved);
    text=L"a\U0001F600b";
    check(text.size()==4);check(fpks::applyDeltas(text,{{3,4,L"c"}}));check(text==L"a\U0001F600c");
    check(fpks::applyDeltas(text,{{1,3,L""}}));check(text==L"ac");
    check(fpks::applyDeltas(text,{}));
    std::cout<<"edit delta failures="<<failures<<'\n';return failures?1:0;
}
