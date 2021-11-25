import {formatVideoDecoderConfigure, noop} from "../utils";
import Emitter from "../utils/emitter";
import {ENCODED_VIDEO_TYPE, EVENTS} from "../constant";


export default class WebcodecsDecoder extends Emitter {
    constructor(player) {
        super();
        this.player = player;
        this.hasInit = false;
        this.isInitInfo = false;
        this.decoder = null;
        this.initDecoder();
        player.debug.log('Webcodecs', 'init')
    }

    initDecoder() {
        const _this = this;
        this.decoder = new VideoDecoder({
            output(videoFrame) {
                _this.handleDecode(videoFrame)
            },
            error(error) {
                _this.handleError(error)
            }
        })
    }

    handleDecode(videoFrame) {
        if (!this.isInitInfo) {
            this.player.video.updateVideoInfo({
                width: videoFrame.codedWidth,
                height: videoFrame.codedHeight
            })
            this.player.video.initCanvasViewSize();
            this.isInitInfo = true;
        }

        this.player.handleRender();
        this.player.video.render({
            videoFrame
        })
        this.player.updateStats({ts: 0, buf: 0})

        // release resource
        setTimeout(function () {
            if (videoFrame.close) {
                videoFrame.close()
            } else {
                videoFrame.destroy()
            }
        }, 100)
    }

    handleError(error) {
        this.player.debug.log('Webcodecs', 'VideoDecoder handleError', error)
    }

    decodeVideo(payload, ts, isIframe) {
        if (!this.hasInit) {
            if (isIframe && payload[1] === 0) {
                const videoCodec = (payload[0] & 0x0F);
                this.player.video.updateVideoInfo({
                    encTypeCode: videoCodec
                })
                const config = formatVideoDecoderConfigure(payload.slice(5));
                this.decoder.configure(config);
                this.hasInit = true;
            }
        } else {
            const chunk = new EncodedVideoChunk({
                data: payload.slice(5),
                timestamp: ts,
                type: isIframe ? ENCODED_VIDEO_TYPE.key : ENCODED_VIDEO_TYPE.delta
            })
            this.decoder.decode(chunk);
        }
    }


    destroy() {
        this.decoder.close();
        this.decoder = null;
        this.hasInit = false;
        this.isInitInfo = false;
        this.player.debug.log('Webcodecs', 'destroy')
        this.player = null;
    }
}