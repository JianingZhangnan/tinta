#pragma once
struct App;
// Optional FPKS profile: no WebView or JavaScript runtime loads on the
// ordinary native reading path. The browser lifetime belongs to the window.
namespace fpks {
bool frame(App& app);
void shutdown();
void nativeFrame();
}
