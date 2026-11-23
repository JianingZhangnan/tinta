import {renderMarkdown} from './markdown.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,...renderMarkdown(data.source)})}catch(e){self.postMessage({id:data.id,error:String(e)})}};
