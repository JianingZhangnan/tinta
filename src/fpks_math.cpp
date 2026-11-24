#include "fpks_math.h"
#include "app.h"
#include "editor.h"
#include "file_utils.h"
#include "json.h"
#include "edit_delta.h"
#include "export.h"
#include "input.h"
#include "overlays.h"
#include "tabs.h"
#include "utils.h"
#include <WebView2.h>
#include <wrl.h>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <shlobj.h>
#include <shellapi.h>

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Callback;
namespace fs = std::filesystem;
namespace fpks {
namespace {
struct Panel {
    App* app = nullptr;
    bool attempted=false,failed=false,ready=false,wanted=false,editing=false,visible=false;
    ComPtr<ICoreWebView2Environment> environment;
    ComPtr<ICoreWebView2Controller> controller;
    ComPtr<ICoreWebView2> web;
    std::wstring assets,profile;
    std::string path,session,mode;
    const void* root=nullptr;
    int tab=-1;
    unsigned long long revision=0,sequence=0;
    const void* mathRoot=nullptr;
    std::string mathPath;
    bool containsMath=false;
    bool lineIndexDirty=false;
    std::wstring snippetsFile;
    fs::file_time_type snippetsStamp{};
    D2D1_COLOR_F background{},foreground{};
    float zoom=0;
    Clock::time_point started;
};
Panel panel;
const auto processStarted=Clock::now();
std::wstring executableDir(){wchar_t path[32768]{};GetModuleFileNameW(nullptr,path,32768);return fs::path(path).parent_path().wstring();}
std::wstring appData(){wchar_t path[MAX_PATH]{};SHGetFolderPathW(nullptr,CSIDL_APPDATA,nullptr,SHGFP_TYPE_CURRENT,path);return path;}
std::string quote(std::string_view text){std::string s="\"";for(unsigned char c:text){switch(c){case '"':s+="\\\"";break;case '\\':s+="\\\\";break;case '\n':s+="\\n";break;case '\r':s+="\\r";break;case '\t':s+="\\t";break;default:if(c<32){char b[7];snprintf(b,sizeof(b),"\\u%04x",c);s+=b;}else s+=static_cast<char>(c);}}return s+'"';}
std::string field(const json::Json& value,const char* key){const auto* v=value.get(key);return v&&v->type==json::Json::String?v->text:std::string();}
size_t integer(const json::Json& value,const char* key){const auto* v=value.get(key);return v&&v->type==json::Json::Number&&v->number>=0?static_cast<size_t>(v->number):0;}
void log(std::string_view message){
    std::error_code ec;auto dir=fs::path(appData())/L"Tinta";fs::create_directories(dir,ec);
    std::ofstream out(dir/L"fpks-metrics.log",std::ios::app);out<<GetCurrentProcessId()<<' '<<message<<'\n';
}
void post(const std::string& message){if(panel.web&&panel.ready)panel.web->PostWebMessageAsJson(toWide(message).c_str());}
std::string color(D2D1_COLOR_F c){char b[10];snprintf(b,sizeof(b),"#%02x%02x%02x",int(c.r*255+.5f),int(c.g*255+.5f),int(c.b*255+.5f));return quote(b);}
std::string colors(const App& app){return "{\"page\":"+color(app.theme.background)+",\"ink\":"+color(app.theme.text)+",\"muted\":"+color(app.theme.syntaxComment)+",\"accent\":"+color(app.theme.accent)+",\"line\":"+color(app.theme.blockquoteBorder)+"}";}
bool markdownPath(const std::string& path){auto extension=fs::path(toWide(path)).extension().wstring();for(auto& c:extension)c=towlower(c);return path.empty()||extension==L".md"||extension==L".markdown";}
bool hasMath(const ElementPtr& root){
    if(!root)return false;
    std::vector<const Element*> pending{root.get()};
    while(!pending.empty()){const auto* node=pending.back();pending.pop_back();if(node->type==ElementType::MathInline||node->type==ElementType::MathDisplay)return true;for(const auto& child:node->children)pending.push_back(child.get());}
    return false;
}
void hide(){
    if(panel.controller&&panel.visible){
        panel.controller->put_IsVisible(FALSE);
        ComPtr<ICoreWebView2_3> suspend;
        if(SUCCEEDED(panel.web.As(&suspend)))suspend->TrySuspend(Callback<ICoreWebView2TrySuspendCompletedHandler>([](HRESULT,BOOL)->HRESULT{return S_OK;}).Get());
    }
    panel.visible=false;
}
void refreshLines(App& app){
    if(!panel.lineIndexDirty)return;
    app.editorLineStarts.clear();app.editorLineStarts.push_back(0);
    for(size_t i=0;i<app.editorText.size();++i)if(app.editorText[i]==L'\n')app.editorLineStarts.push_back(i+1);
    app.clearEditorLineLayoutCache();panel.lineIndexDirty=false;
}
void synchronize(App& app){
    if(!panel.ready||!panel.wanted)return;
    // Saving or rebuilding native preview data does not replace the editor's
    // document. Keep CodeMirror history and scroll position across that work.
    if(panel.path==app.currentFile&&panel.tab==app.activeTab&&panel.editing&&app.editMode&&panel.revision==app.editorTextRevision)panel.root=app.root.get();
    bool changed=panel.path!=app.currentFile||panel.tab!=app.activeTab||panel.root!=app.root.get()||panel.editing!=app.editMode;
    if(!changed&&panel.editing&&panel.revision!=app.editorTextRevision)changed=true;
    if(changed){
        panel.path=app.currentFile;panel.tab=app.activeTab;panel.root=app.root.get();panel.editing=app.editMode;panel.revision=app.editorTextRevision;
        panel.session=std::to_string(++panel.sequence);
        std::string text=app.editMode?toUtf8(app.editorText):app.sourceText;
        // The browser parser and CodeMirror agree on LF UTF-16 offsets.
        if(!app.editMode){text.erase(std::remove(text.begin(),text.end(),'\r'),text.end());if(text.compare(0,3,"\xef\xbb\xbf")==0)text.erase(0,3);}
        ComPtr<ICoreWebView2_3> mapped;
        if(SUCCEEDED(panel.web.As(&mapped))&&!app.currentFile.empty()){
            auto folder=fs::path(toWide(app.currentFile)).parent_path().wstring();
            mapped->SetVirtualHostNameToFolderMapping(L"document.tinta.local",folder.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);
        }
        panel.mode=!app.editMode||app.editorReadingPreview?"read":app.editorShowPreview?"split":"source";
        post("{\"type\":\"document\",\"session\":"+quote(panel.session)+",\"path\":"+quote(app.currentFile)+",\"text\":"+quote(text)+",\"edit\":"+(app.editMode?"true":"false")+",\"mode\":"+quote(panel.mode)+",\"dirty\":"+(app.editorDirty?"true":"false")+",\"colors\":"+colors(app)+",\"fontSize\":"+std::to_string(19*app.zoomFactor)+"}");
    }
    const std::string mode=!app.editMode||app.editorReadingPreview?"read":app.editorShowPreview?"split":"source";
    if(panel.mode!=mode){
        panel.mode=mode;post("{\"type\":\"mode\",\"mode\":"+quote(mode)+",\"session\":"+quote(panel.session)+"}");
    }
    if(panel.background.r!=app.theme.background.r||panel.background.g!=app.theme.background.g||panel.foreground.r!=app.theme.text.r||panel.zoom!=app.zoomFactor){
        panel.background=app.theme.background;panel.foreground=app.theme.text;panel.zoom=app.zoomFactor;
        post("{\"type\":\"theme\",\"colors\":"+colors(app)+",\"fontSize\":"+std::to_string(19*app.zoomFactor)+"}");
    }
}
void message(App& app,const std::string& text){
    json::JsonReader reader{text};json::Json m;if(!reader.value(m))return;
    auto type=field(m,"type");
    if(type=="ready"){panel.ready=true;panel.root=nullptr;panel.tab=-2;synchronize(app);log("bridge-ready-us="+std::to_string(usElapsed(panel.started)));InvalidateRect(app.hwnd,nullptr,FALSE);return;}
    if(type=="metrics"||type=="error"){log(text);return;}
    if(field(m,"session")!=panel.session)return; // Ignore events from a document replaced by a tab switch.
    if(type=="mathVisible"){
        log("math-visible-us="+std::to_string(usElapsed(processStarted)));return;
    }else if(type=="diagram"){
        const auto source=field(m,"source");
        if(source.size()>1024*1024)return;
        post("{\"type\":\"diagram\",\"session\":"+quote(panel.session)+",\"generation\":"+std::to_string(integer(m,"generation"))+",\"id\":"+std::to_string(integer(m,"id"))+",\"svg\":"+quote(exportDiagramSvg(app,source))+"}");return;
    }else if(type=="edit"){
        if(!app.editMode){enterEditMode(app);panel.editing=true;panel.revision=app.editorTextRevision;panel.root=app.root.get();}
        panel.mode=app.editorReadingPreview?"read":app.editorShowPreview?"split":"source";
    }else if(type=="mode"){
        const auto mode=field(m,"mode");
        if(mode!="read"&&mode!="source"&&mode!="split")return;
        if(mode!="read"&&!app.editMode)enterEditMode(app);
        if(app.editMode){
            setEditorReadingPreview(app,mode=="read");
            if(mode!="read")app.editorShowPreview=mode=="split";
        }
        panel.editing=app.editMode;panel.root=app.root.get();panel.revision=app.editorTextRevision;panel.mode=mode;
    }else if(type=="contextMenu"){
        const float x=static_cast<float>(integer(m,"x"));
        const float y=static_cast<float>(integer(m,"y"))+chromeTopHeight(app);
        openContextMenu(app,x,y,false);
    }else if(type=="exitEdit"){
        refreshLines(app);exitEditMode(app);
    }else if(type=="changes"){
        if(!app.editMode)return;
        const auto* changes=m.get("changes");if(!changes||changes->type!=json::Json::Array)return;
        // Validate the complete transaction before applying any part of it.
        std::vector<TextDelta> transaction;transaction.reserve(changes->items.size());
        for(const auto& change:changes->items){
            const auto* from=change.get("from");const auto* to=change.get("to");const auto* insert=change.get("insert");
            if(!from||!to||!insert||from->type!=json::Json::Number||to->type!=json::Json::Number||insert->type!=json::Json::String||from->number<0||to->number<0)return;
            transaction.push_back({integer(change,"from"),integer(change,"to"),toWide(insert->text)});
        }
        if(!applyDeltas(app.editorText,transaction))return;
        app.editorCursorPos=std::min(integer(m,"cursor"),app.editorText.size());
        app.editorDirty=true;++app.editorTextRevision;panel.revision=app.editorTextRevision;
        app.editorDocCountsStale=true;panel.lineIndexDirty=true;
        updateWindowTitle(app);
    }else if(type=="save"||type=="saveAs"){
        if(!app.editMode)enterEditMode(app);
        refreshLines(app);
        if(type=="saveAs")saveEditorFileAs(app,app.hwnd);else saveEditorFile(app,app.hwnd);
        if(!app.editorDirty){panel.root=app.root.get();panel.revision=app.editorTextRevision;panel.path=app.currentFile;post("{\"type\":\"saved\"}");}
    }else if(type=="open")openFileDialog(app,app.hwnd);
    else if(type=="link"){
        auto href=field(m,"href");
        refreshLines(app);followDocumentLink(app,app.hwnd,href);
    }
    InvalidateRect(app.hwnd,nullptr,FALSE);
}
void refreshSharedSnippets(){
    std::ifstream in(fs::path(panel.profile)/L"source.json");std::string source((std::istreambuf_iterator<char>(in)),{});
    if(source.compare(0,3,"\xef\xbb\xbf")==0)source.erase(0,3);
    json::JsonReader reader{source};json::Json data;if(!reader.value(data))return;
    auto file=field(data,"snippets");
    if(!file.empty()){
        std::error_code ec;panel.snippetsFile=toWide(file);
        const auto stamp=fs::last_write_time(panel.snippetsFile,ec);if(ec||stamp==panel.snippetsStamp)return;
        fs::copy_file(fs::path(panel.snippetsFile),fs::path(panel.profile)/L"snippets.js",fs::copy_options::overwrite_existing,ec);
        if(!ec){bool wasLoaded=panel.snippetsStamp!=fs::file_time_type{};panel.snippetsStamp=stamp;if(wasLoaded)post("{\"type\":\"profileChanged\"}");}
    }
}
void begin(App& app){
    panel.attempted=true;panel.app=&app;panel.started=Clock::now();refreshSharedSnippets();
    SetTimer(app.hwnd,30,2000,[](HWND,UINT,UINT_PTR,DWORD){if(panel.app)refreshSharedSnippets();});
    auto loaderPath=fs::path(executableDir())/L"WebView2Loader.dll";
    HMODULE loader=LoadLibraryW(loaderPath.c_str());
    if(!loader){panel.failed=true;log("WebView2Loader unavailable");return;}
    using CreateEnvironment=HRESULT(STDAPICALLTYPE*)(PCWSTR,PCWSTR,ICoreWebView2EnvironmentOptions*,ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
    auto create=reinterpret_cast<CreateEnvironment>(GetProcAddress(loader,"CreateCoreWebView2EnvironmentWithOptions"));
    if(!create){panel.failed=true;return;}
    wchar_t customCache[32768]{};
    auto cache=GetEnvironmentVariableW(L"TINTA_FPKS_CACHE",customCache,32768)?fs::path(customCache):fs::path(executableDir()).parent_path()/L"_cache"/L"Tinta"/L"WebView2";
    std::error_code ec;fs::create_directories(cache,ec);
    HRESULT hr=create(nullptr,cache.c_str(),nullptr,Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([](HRESULT result,ICoreWebView2Environment* env)->HRESULT{
        if(FAILED(result)||!env||!panel.app){panel.failed=true;log("WebView2 environment failed");return S_OK;}
        panel.environment=env;
        return env->CreateCoreWebView2Controller(panel.app->hwnd,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([](HRESULT result,ICoreWebView2Controller* controller)->HRESULT{
            if(FAILED(result)||!controller||!panel.app){panel.failed=true;log("WebView2 controller failed");return S_OK;}
            panel.controller=controller;controller->get_CoreWebView2(&panel.web);
            RECT bounds{};GetClientRect(panel.app->hwnd,&bounds);bounds.top=static_cast<LONG>(chromeTopHeight(*panel.app));
            controller->put_Bounds(bounds);
            controller->put_IsVisible(panel.wanted?TRUE:FALSE);panel.visible=panel.wanted;
            ComPtr<ICoreWebView2_3> mapped;
            if(FAILED(panel.web.As(&mapped))){panel.failed=true;return S_OK;}
            mapped->SetVirtualHostNameToFolderMapping(L"tinta.local",panel.assets.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);
            mapped->SetVirtualHostNameToFolderMapping(L"fpks.tinta.local",panel.profile.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
            ComPtr<ICoreWebView2Settings> settings;panel.web->get_Settings(&settings);
            settings->put_AreDefaultContextMenusEnabled(FALSE);settings->put_IsStatusBarEnabled(FALSE);
            EventRegistrationToken token;
            panel.web->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([](ICoreWebView2*,ICoreWebView2WebMessageReceivedEventArgs* args)->HRESULT{
                LPWSTR json=nullptr,origin=nullptr;args->get_Source(&origin);
                bool trusted=origin&&std::wstring_view(origin).rfind(L"https://tinta.local/",0)==0;CoTaskMemFree(origin);
                if(trusted&&panel.app&&SUCCEEDED(args->get_WebMessageAsJson(&json))&&json){message(*panel.app,toUtf8(json));CoTaskMemFree(json);}return S_OK;
            }).Get(),&token);
            panel.web->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>([](ICoreWebView2*,ICoreWebView2NavigationStartingEventArgs* args)->HRESULT{
                LPWSTR uri=nullptr;args->get_Uri(&uri);if(uri&&std::wstring_view(uri).rfind(L"https://tinta.local/",0)!=0)args->put_Cancel(TRUE);CoTaskMemFree(uri);return S_OK;
            }).Get(),&token);
            panel.web->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2NewWindowRequestedEventArgs* args)->HRESULT{args->put_Handled(TRUE);return S_OK;}).Get(),&token);
            panel.web->Navigate(L"https://tinta.local/index.html");
            InvalidateRect(panel.app->hwnd,nullptr,FALSE);return S_OK;
        }).Get());
    }).Get());
    if(FAILED(hr)){panel.failed=true;log("WebView2 create failed");}
}
}
bool frame(App& app){
    if(panel.failed)return false;
    if(panel.assets.empty()){
        panel.assets=(fs::path(executableDir())/L"fpks").wstring();
        panel.profile=(fs::path(appData())/L"Tinta"/L"fpks-profile").wstring();
        if(!fs::exists(fs::path(panel.assets)/L"index.html")||!fs::exists(fs::path(panel.profile)/L"main.js")){panel.failed=true;return false;}
    }
    // Native text/Markdown without equations does not start a browser. Source
    // editing needs the real suite even before mk/dm create the first equation.
    if(panel.mathRoot!=app.root.get()||panel.mathPath!=app.currentFile){
        panel.mathRoot=app.root.get();panel.mathPath=app.currentFile;
        panel.containsMath=markdownPath(app.currentFile)&&app.sourceText.find('$')!=std::string::npos&&hasMath(app.root);
    }
    panel.wanted=markdownPath(app.currentFile)&&(app.editMode||panel.containsMath);
    if(app.showHelp||app.showSettings||app.showThemeChooser||app.showPrintPreview||app.confirmExitPending||app.showTabMenu||app.showTabSwitcher||app.showThemeEditor||app.showContextMenu)panel.wanted=false;
    if(!panel.wanted){refreshLines(app);hide();return false;}
    if(!panel.attempted)begin(app);
    synchronize(app);
    if(!panel.ready||!panel.controller)return false;
    RECT bounds{};GetClientRect(app.hwnd,&bounds);bounds.top=static_cast<LONG>(chromeTopHeight(app));
    panel.controller->put_Bounds(bounds);
    if(!panel.visible){ComPtr<ICoreWebView2_3> resume;if(SUCCEEDED(panel.web.As(&resume)))resume->Resume();panel.controller->put_IsVisible(TRUE);if(app.editMode&&!app.editorReadingPreview)panel.controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);panel.visible=true;}
    return true;
}
void shutdown(){if(panel.app)KillTimer(panel.app->hwnd,30);hide();if(panel.controller)panel.controller->Close();panel.web.Reset();panel.controller.Reset();panel.environment.Reset();panel.app=nullptr;}
void nativeFrame(){static bool logged=false;if(!logged){logged=true;log("native-first-frame-us="+std::to_string(usElapsed(processStarted)));}}
}
