# MASTER PROMPT — XÂY DỰNG NỀN TẢNG ĐẶT XE VÀ KẾT NỐI TÀI XẾ TOÀN DIỆN

## 1. TẦM NHÌN SẢN PHẨM

Hãy tự lên ý tưởng, thiết kế UX/UI, kiến trúc hệ thống và lập trình hoàn chỉnh một nền tảng web đặt xe thông minh, kết nối khách hàng với các tài xế và đơn vị vận tải.

Nền tảng hoạt động theo mô hình đặt xe theo yêu cầu: khách lựa chọn loại xe, điểm đón, điểm trả, thời gian và các nhu cầu khác. Hệ thống tìm tài xế đang hoạt động và phù hợp để nhận chuyến.

Sản phẩm phục vụ nhu cầu di chuyển nội thành, liên tỉnh, đưa đón sân bay, thuê xe riêng, xe gia đình, xe nhóm và xe khách cỡ lớn.

Lấy cảm hứng về sự thuận tiện của Grab, sự trực quan của Google Maps và khả năng điều phối của các nền tảng vận tải hiện đại, nhưng xây dựng bản sắc sản phẩm riêng.

**Nguyên tắc cốt lõi:**
- Đẹp, hiện đại, chuyên nghiệp, tạo cảm giác đáng tin cậy.
- Cực kỳ dễ sử dụng, kể cả người không rành công nghệ.
- Ít thao tác nhất có thể để hoàn thành một lượt đặt xe.
- Đầy đủ tính năng nhưng không khiến giao diện phức tạp.
- Tối ưu cho điện thoại trước, đồng thời đẹp trên desktop.
- Có khả năng vận hành thực tế và mở rộng lâu dài.
- Từng tính năng phải có chức năng thật, không chỉ là giao diện minh họa.

## 2. GIAO DIỆN VÀ TRẢI NGHIỆM

Thiết kế một hệ thống thống nhất cho ba nhóm: khách hàng, tài xế và quản trị viên.

Phong cách hiện đại, sạch sẽ, dễ nhận diện. Bản đồ là yếu tố trực quan quan trọng. Form đặt xe dễ nhìn, lựa chọn rõ ràng, các bước được hướng dẫn tự nhiên.

Tập trung vào:
- Giao diện tối giản nhưng giàu chức năng.
- Responsive hoàn chỉnh cho điện thoại, tablet và máy tính.
- Tìm kiếm nhanh, tự động gợi ý, giảm số lần nhập liệu.
- Các lựa chọn bằng thẻ trực quan, biểu tượng và hình minh họa.
- Loading, thông báo, xác nhận và trạng thái trực quan.
- Animation vừa phải, tạo cảm giác mượt.
- Hỗ trợ tiếng Việt tốt, định dạng tiền VNĐ.
- Hỗ trợ dark mode nếu phù hợp.
- Trải nghiệm thống nhất, thao tác một tay thuận tiện trên mobile.
- Có trạng thái rỗng, lỗi mạng, mất GPS và không tìm thấy tài xế.

Hãy chủ động nghiên cứu cách tổ chức trải nghiệm tốt nhất, tránh sao chép máy móc từ một ứng dụng cụ thể.

## 3. TRANG KHÁCH HÀNG — ĐẶT XE

Xây dựng một trải nghiệm đặt xe đầy đủ, nhanh chóng và dễ hiểu.

### Bản đồ tương tác

- Hiển thị bản đồ thực tế.
- Xác định vị trí hiện tại nếu được người dùng cho phép.
- Tìm kiếm địa điểm và địa chỉ.
- Tự động gợi ý địa chỉ khi nhập.
- Chọn điểm đón và điểm trả trực tiếp trên bản đồ.
- Kéo thả ghim để điều chỉnh vị trí chính xác.
- Hiển thị tuyến đường dự kiến.
- Ước tính quãng đường và thời gian di chuyển.
- Hiển thị các điểm đón, điểm trả, điểm dừng.
- Chọn lại vị trí, đảo chiều hành trình.
- Lưu địa điểm quen thuộc như nhà riêng, công ty.
- Xem vị trí tài xế khi đã ghép chuyến và được phép theo dõi.

### Các lựa chọn đặt xe

Cho khách lựa chọn linh hoạt:

- Loại xe: 4, 7, 9, 16, 29, 35, 45 chỗ hoặc loại xe do quản trị viên cấu hình.
- Số lượng hành khách.
- Đi một chiều hoặc khứ hồi.
- Đặt ngay hoặc lên lịch trước.
- Thuê xe theo chuyến, theo giờ hoặc theo ngày.
- Điểm đón, điểm trả và nhiều điểm dừng.
- Thời gian đón và thời gian chiều về.
- Số lượng hành lý.
- Yêu cầu đặc biệt: ghế trẻ em, khoang hành lý lớn, hỗ trợ người cao tuổi, v.v.
- Loại xe tiêu chuẩn hoặc cao cấp khi có nguồn cung.
- Ghi chú cho tài xế.
- Phương thức thanh toán.
- Mã giảm giá, ưu đãi nếu có.

Không cần hiển thị tất cả lựa chọn ngay từ đầu. Hãy sử dụng giao diện thông minh, chỉ mở rộng tùy chọn khi khách cần.

### Tìm xe và xác nhận đặt chuyến

- Hiển thị các loại xe phù hợp với yêu cầu.
- Cho khách so sánh các lựa chọn.
- Hiển thị giá dự kiến rõ ràng.
- Thông báo phụ phí và điều kiện phát sinh.
- Ước tính thời gian có xe.
- Tóm tắt hành trình trước khi xác nhận.
- Cho phép chỉnh sửa nhanh trước khi đặt.
- Hiển thị quá trình đang tìm tài xế.
- Thông báo khi có tài xế nhận chuyến.
- Có giải pháp khi chưa tìm được tài xế.
- Tránh đặt trùng do nhấn nhiều lần.

## 4. HỆ THỐNG TÀI XẾ

Xây dựng trang tài xế riêng, tối ưu cho điện thoại.

### Hồ sơ tài xế

- Đăng ký, đăng nhập.
- Quản lý thông tin cá nhân.
- Thông tin bằng lái, giấy tờ cần thiết.
- Đăng ký phương tiện.
- Biển số, loại xe, số ghế, hình ảnh xe.
- Đơn vị vận tải trực thuộc nếu có.
- Khu vực hoạt động.
- Lịch sử chuyến đi.
- Đánh giá từ khách.
- Trạng thái xác minh và phê duyệt.

### Trạng thái hoạt động

Tài xế có thể chuyển đổi dễ dàng giữa:

- Online — Sẵn sàng nhận chuyến.
- Offline — Không nhận chuyến.
- Đang thực hiện chuyến.
- Tạm nghỉ hoặc tạm dừng nhận chuyến.

Chỉ gửi chuyến mới cho tài xế đủ điều kiện và đang sẵn sàng.

### Tiếp nhận và xử lý cuốc

- Nhận thông báo chuyến mới theo thời gian thực.
- Xem điểm đón, điểm trả trên bản đồ.
- Xem khoảng cách và hành trình dự kiến.
- Xem loại xe, số khách, hành lý và yêu cầu.
- Xem giá chuyến và thu nhập dự kiến.
- Nhận hoặc từ chối cuốc.
- Có thời hạn phản hồi phù hợp.
- Tránh nhiều tài xế cùng nhận một chuyến.
- Tự động ngừng nhận cuốc mới khi đang bận.
- Chỉ đường đến điểm đón.
- Liên hệ với khách.
- Xác nhận đã tới điểm đón.
- Bắt đầu chuyến.
- Hoàn thành chuyến.
- Báo cáo sự cố, hủy chuyến với lý do rõ ràng.

### Quản lý thu nhập

- Tổng thu nhập theo ngày, tuần, tháng.
- Số lượng chuyến hoàn thành.
- Chuyến bị hủy.
- Hoa hồng nền tảng.
- Số dư và lịch sử thanh toán.
- Thống kê hiệu quả hoạt động.

## 5. HỆ THỐNG GHÉP CUỐC VÀ ĐIỀU PHỐI

Đây là phần cốt lõi của nền tảng.

Hệ thống cần có cơ chế tự động ghép chuyến với tài xế phù hợp, dựa trên:

- Trạng thái online.
- Loại xe và số ghế.
- Vị trí hoặc khu vực hoạt động.
- Khoảng cách tới điểm đón.
- Thời gian có thể phục vụ.
- Lịch trình đang có.
- Các yêu cầu đặc biệt của khách.
- Điều kiện hoạt động của tài xế và phương tiện.

Cho phép ghép chuyến tự động hoặc quản trị viên chỉ định tài xế thủ công.

Hỗ trợ đặt xe ngay và đặt trước. Các cuốc đặt trước cần được quản lý lịch, tránh trùng lịch tài xế và có cơ chế nhắc nhở.

Khi tài xế không nhận hoặc hết thời gian phản hồi, hệ thống có thể tìm tài xế khác. Khi không còn tài xế phù hợp, khách phải được thông báo rõ ràng và có phương án thay thế.

Đảm bảo xử lý đồng thời an toàn, không nhận trùng cuốc, không sai trạng thái và không tạo đặt xe ảo.

## 6. THEO DÕI HÀNH TRÌNH THỜI GIAN THỰC

Sau khi đặt thành công, khách có màn hình theo dõi chuyến.

Bao gồm:

- Bản đồ hành trình.
- Vị trí tài xế khi được chia sẻ hợp lệ.
- Thông tin xe và tài xế.
- Thời gian tài xế dự kiến tới.
- Trạng thái hiện tại của chuyến.
- Liên hệ tài xế.
- Chia sẻ thông tin chuyến đi với người thân.
- Thông báo khi tài xế đến.
- Cập nhật khi chuyến bắt đầu, kết thúc.
- Lịch sử hành trình và thông tin sau chuyến.

Hệ thống phải xử lý tốt trường hợp GPS yếu, mất kết nối hoặc vị trí chưa thể cập nhật, không hiển thị vị trí giả như dữ liệu thật.

## 7. HỆ THỐNG GIÁ VÀ THANH TOÁN

Xây dựng cơ chế giá linh hoạt, dễ quản lý.

Giá có thể dựa trên:
- Loại xe.
- Quãng đường.
- Thời gian.
- Loại dịch vụ.
- Khu vực hoạt động.
- Phí cầu đường, phí chờ và phụ phí hợp lệ.
- Khung giờ hoặc ngày cao điểm.
- Cấu hình riêng của nhà xe.

Tính năng thanh toán:
- Tiền mặt.
- Chuyển khoản ngân hàng.
- Thanh toán trực tuyến qua nhà cung cấp tích hợp hợp lệ.
- Thanh toán trước hoặc sau chuyến tùy dịch vụ.
- Đặt cọc nếu cần.
- Biên nhận hoặc hóa đơn.
- Mã khuyến mãi.
- Chính sách hoàn tiền.
- Lịch sử giao dịch.
- Đối soát và tính hoa hồng.

Khách luôn biết đâu là giá ước tính, đâu là giá đã được xác nhận. Mọi thay đổi giá cần minh bạch.

## 8. TÀI KHOẢN VÀ CHĂM SÓC KHÁCH HÀNG

### Khách hàng

- Đăng ký, đăng nhập.
- Hồ sơ cá nhân.
- Lưu địa chỉ thường dùng.
- Danh sách chuyến sắp tới.
- Chuyến đang thực hiện.
- Lịch sử đặt xe.
- Đặt lại chuyến cũ.
- Hủy chuyến, đổi lịch khi đủ điều kiện.
- Quản lý thanh toán.
- Đánh giá tài xế.
- Yêu thích tài xế hoặc nhà xe.
- Quản lý thông báo.
- Ưu đãi, voucher, giới thiệu bạn bè.

### Hỗ trợ khách hàng

- Trung tâm trợ giúp.
- Câu hỏi thường gặp.
- Liên hệ hỗ trợ.
- Gửi khiếu nại.
- Báo cáo vấn đề.
- Đồ thất lạc.
- Hỗ trợ thay đổi hoặc hủy chuyến.
- Theo dõi trạng thái yêu cầu hỗ trợ.

## 9. TRANG QUẢN TRỊ ADMIN

Xây dựng dashboard để người vận hành quản lý toàn bộ hệ thống.

Bao gồm:

- Tổng quan hoạt động nền tảng.
- Số chuyến mới, đang thực hiện và hoàn thành.
- Danh sách khách hàng.
- Danh sách tài xế.
- Quản lý phương tiện.
- Xác minh hồ sơ tài xế.
- Quản lý nhà xe, đối tác vận tải nếu có.
- Danh sách chuyến theo thời gian thực.
- Bản đồ theo dõi hoạt động.
- Điều phối và chỉ định chuyến.
- Quản lý bảng giá và phụ phí.
- Cấu hình loại xe, khu vực phục vụ.
- Hoa hồng, doanh thu, đối soát.
- Quản lý thanh toán và hoàn tiền.
- Mã giảm giá, chiến dịch khuyến mãi.
- Khiếu nại và hỗ trợ.
- Thống kê, báo cáo.
- Quản lý quyền nhân viên.
- Cấu hình chung của hệ thống.
- Nhật ký hoạt động quan trọng.

Dashboard cần dễ theo dõi, tìm kiếm và lọc nhanh, thuận tiện để điều hành hàng ngày.

## 10. THÔNG BÁO VÀ GIAO TIẾP

Xây dựng hệ thống thông báo thống nhất cho cả khách, tài xế và admin.

Các thông báo quan trọng:

- Đặt xe thành công.
- Đang tìm tài xế.
- Tài xế nhận cuốc.
- Tài xế sắp đến.
- Tài xế đã tới.
- Chuyến bắt đầu.
- Chuyến hoàn thành.
- Chuyến thay đổi hoặc bị hủy.
- Nhắc lịch đặt xe trước.
- Thanh toán và hoàn tiền.
- Yêu cầu hỗ trợ.
- Cuốc mới dành cho tài xế.

Hỗ trợ thông báo trong ứng dụng, push notification khi có điều kiện, SMS hoặc email với những sự kiện cần thiết.

Cung cấp liên hệ khách–tài xế thuận tiện, ưu tiên bảo vệ thông tin cá nhân. Có thể hỗ trợ chat, gọi điện và tin nhắn mẫu.

## 11. TÍNH NĂNG NÂNG CAO VÀ KHẢ NĂNG MỞ RỘNG

Thiết kế hệ thống để có thể bổ sung:

- Đặt xe khứ hồi.
- Đặt xe nhiều chặng.
- Đặt xe định kỳ.
- Đặt xe cho người khác.
- Đặt xe doanh nghiệp.
- Quản lý xe theo đội/nhà xe.
- Hợp đồng thuê xe.
- Xe đưa đón sân bay.
- Xe du lịch theo ngày.
- Dịch vụ đưa đón đoàn.
- Chương trình khách hàng thân thiết.
- Gói dịch vụ cho doanh nghiệp.
- Mở rộng đa tỉnh thành.
- Nhiều phương thức điều phối.
- API tích hợp đối tác.
- Module bán vé theo tuyến và chọn ghế nếu phát triển thêm mô hình xe khách tuyến cố định.

Phân biệt rõ dịch vụ đặt nguyên xe theo yêu cầu với dịch vụ bán vé từng ghế theo tuyến. Luồng đặt nguyên xe là luồng chính của sản phẩm.

## 12. AN TOÀN, BẢO MẬT VÀ ĐỘ TIN CẬY

Xây dựng hệ thống đủ tin cậy để phát triển thành dịch vụ thật.

Đảm bảo:
- Xác thực và phân quyền.
- Bảo vệ dữ liệu cá nhân.
- Bảo mật vị trí và hành trình.
- Xác minh tài xế trước khi nhận khách thật.
- Kiểm soát quyền truy cập chuyến.
- Chống spam, giả mạo và đặt cuốc hàng loạt.
- Tránh dữ liệu trùng lặp.
- Ghi nhận thay đổi trạng thái chuyến.
- Xử lý lỗi thanh toán.
- Xử lý mất mạng, tải lại trang, nhiều thiết bị.
- Sao lưu dữ liệu.
- Quản lý bí mật hệ thống và khóa dịch vụ.
- Cơ chế giám sát lỗi.
- Quyền hủy chuyến, khiếu nại và xử lý sự cố.
- Chính sách dữ liệu, thời hạn lưu trữ và quyền riêng tư.

Trải nghiệm phải minh bạch, không gây hiểu lầm về giá, thời gian tới, trạng thái tài xế hay dữ liệu GPS.

## 13. YÊU CẦU TRIỂN KHAI

Tự lựa chọn công nghệ, framework, cơ sở dữ liệu và kiến trúc phù hợp. Ưu tiên sự đơn giản trong vận hành nhưng vẫn có nền tảng tốt để mở rộng.

Hãy thực hiện trọn vẹn từ đầu đến cuối:

1. Phân tích ý tưởng và các luồng sử dụng.
2. Thiết kế cấu trúc sản phẩm và kiến trúc hệ thống.
3. Thiết kế UI/UX hiện đại, hoàn chỉnh.
4. Lập trình frontend đầy đủ.
5. Lập trình backend và API.
6. Thiết kế cơ sở dữ liệu.
7. Tích hợp bản đồ, địa chỉ, tuyến đường và vị trí.
8. Xây dựng ghép chuyến và cập nhật realtime.
9. Xây dựng hệ thống đăng nhập và phân quyền.
10. Xây dựng trang tài xế và trang admin.
11. Kết nối các tính năng thành luồng thực tế.
12. Kiểm thử những tình huống quan trọng.
13. Chuẩn bị cấu hình môi trường và dữ liệu thử nghiệm.
14. Viết tài liệu chạy dự án và hướng dẫn triển khai.
15. Hoàn thiện thành sản phẩm có thể dùng thử ngay.

Không chỉ tạo mockup hoặc giao diện tĩnh. Các hành động phải hoạt động thật, dữ liệu phải được lưu, frontend và backend phải kết nối được.

Với những tích hợp bên ngoài đòi hỏi tài khoản hoặc API key như bản đồ, OTP, SMS, thanh toán, hãy xây dựng sẵn kiến trúc tích hợp, chỉ rõ cấu hình cần bổ sung. Có thể có chế độ demo để kiểm thử nhưng phải phân biệt rõ mô phỏng và chức năng vận hành thật. Không giả vờ rằng giao dịch hay GPS đã hoạt động khi chưa tích hợp.

## 14. ƯU TIÊN TRẢI NGHIỆM VÀ CHẤT LƯỢNG

Ưu tiên một trải nghiệm xuyên suốt:

**Khách:** Mở web → Chọn hành trình trên bản đồ → Chọn loại xe và tùy chọn → Xem giá → Xác nhận → Ghép tài xế → Theo dõi → Hoàn thành → Đánh giá.

**Tài xế:** Đăng nhập → Bật Online → Nhận thông báo cuốc phù hợp → Xem chuyến → Chấp nhận → Đón khách → Thực hiện → Hoàn thành → Xem thu nhập.

**Admin:** Đăng nhập → Theo dõi hoạt động → Quản lý tài xế/xe/chuyến → Điều phối nếu cần → Kiểm soát doanh thu và hỗ trợ khách hàng.

Tất cả phải có sự liên kết về dữ liệu và trạng thái.

Các yếu tố quan trọng nhất là:
- Dễ sử dụng hơn là nhiều nút.
- Hoàn thành đặt xe nhanh hơn là nhiều màn hình.
- Thông tin rõ ràng hơn là giao diện hào nhoáng.
- Hệ thống tin cậy hơn là nhiều tính năng chưa hoàn thiện.
- Dễ mở rộng hơn là xây dựng cứng cho một trường hợp.
- Chất lượng trên mobile quan trọng tương đương desktop.

## 15. CÁCH LÀM VIỆC VÀ BÀN GIAO

Hãy chủ động đóng vai trò Product Manager, UX/UI Designer, Software Architect, Full-stack Developer và QA Engineer.

Tự đưa ra các quyết định hợp lý, không liên tục hỏi lại những chi tiết nhỏ. Có thể chia quá trình xây dựng thành các giai đoạn nội bộ nhưng mục tiêu cuối cùng là một website thống nhất, hoạt động xuyên suốt.

Ưu tiên xây dựng đầy đủ luồng cốt lõi trước, sau đó bổ sung các tính năng tiện ích và nâng cao. Không hy sinh chức năng thực tế chỉ để tạo ra nhiều màn hình.

**Đầu ra mong muốn:**
- Website khách hàng hoàn chỉnh.
- Website tài xế hoàn chỉnh.
- Trang quản trị hoàn chỉnh.
- Bản đồ tương tác và đặt xe trực quan.
- Hệ thống ghép chuyến hoạt động.
- Backend và database sử dụng được.
- Các tính năng tương tác và trạng thái realtime.
- Dữ liệu demo hợp lý.
- Mã nguồn đầy đủ.
- Hướng dẫn chạy, cấu hình và triển khai.
- Kiểm thử các luồng đặt xe và nhận cuốc.
- Danh sách rõ ràng những tích hợp còn cần dịch vụ bên ngoài.

**Tiêu chí hoàn thành:** Có thể mở website trên hai thiết bị khác nhau, một thiết bị đóng vai khách, một thiết bị đóng vai tài xế. Khách đặt chuyến trên bản đồ, tài xế phù hợp đang Online nhìn thấy cuốc và nhận chuyến, hai bên thấy trạng thái cập nhật, tài xế hoàn thành chuyến, admin nhìn thấy dữ liệu. Các tình huống không có tài xế, hủy chuyến, lỗi kết nối và nhận cuốc trùng cũng phải được xử lý hợp lý.

Hãy xây dựng như một sản phẩm thật có tiềm năng thương mại hóa, không phải một bản demo giao diện sơ sài.