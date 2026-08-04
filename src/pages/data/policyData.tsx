import { FaInfoCircle } from "react-icons/fa";

export const POLICY_NAV_ITEMS = [
  {
    "key": "cat-0",
    "labelVi": "1. Mục đích",
    "labelEn": "1. Mục đích"
  },
  {
    "key": "cat-1",
    "labelVi": "2. Phạm vi áp dụng",
    "labelEn": "2. Phạm vi áp dụng"
  },
  {
    "key": "cat-2",
    "labelVi": "3. Nguyên tắc cộng đồng",
    "labelEn": "3. Nguyên tắc cộng đồng"
  },
  {
    "key": "cat-3",
    "labelVi": "4. Tài khoản và bảo mật đăng nhập",
    "labelEn": "4. Tài khoản và bảo mật đăng nhập"
  },
  {
    "key": "cat-4",
    "labelVi": "5. Nội dung người dùng",
    "labelEn": "5. Nội dung người dùng"
  },
  {
    "key": "cat-5",
    "labelVi": "6. Quyền riêng tư và đối tượng xem",
    "labelEn": "6. Quyền riêng tư và đối tượng xem"
  },
  {
    "key": "cat-6",
    "labelVi": "7. Bạn bè, theo dõi và chặn",
    "labelEn": "7. Bạn bè, theo dõi và chặn"
  },
  {
    "key": "cat-7",
    "labelVi": "8. Tin nhắn và hội thoại",
    "labelEn": "8. Tin nhắn và hội thoại"
  },
  {
    "key": "cat-8",
    "labelVi": "9. Tìm kiếm và khám phá",
    "labelEn": "9. Tìm kiếm và khám phá"
  },
  {
    "key": "cat-9",
    "labelVi": "10. Bảng tin và nội dung đề xuất",
    "labelEn": "10. Bảng tin và nội dung đề xuất"
  },
  {
    "key": "cat-10",
    "labelVi": "11. Thông báo",
    "labelEn": "11. Thông báo"
  },
  {
    "key": "cat-11",
    "labelVi": "12. Premium và thanh toán",
    "labelEn": "12. Premium và thanh toán"
  },
  {
    "key": "cat-12",
    "labelVi": "13. Bảo vệ hệ thống và API",
    "labelEn": "13. Bảo vệ hệ thống và API"
  },
  {
    "key": "cat-13",
    "labelVi": "14. Thực thi chính sách",
    "labelEn": "14. Thực thi chính sách"
  },
  {
    "key": "cat-14",
    "labelVi": "15. Hạn chế dịch vụ",
    "labelEn": "15. Hạn chế dịch vụ"
  },
  {
    "key": "cat-15",
    "labelVi": "16. Các chức năng không thuộc phạm vi hiện tại",
    "labelEn": "16. Các chức năng không thuộc phạm vi hiện tại"
  },
  {
    "key": "cat-16",
    "labelVi": "17. Thay đổi chính sách",
    "labelEn": "17. Thay đổi chính sách"
  },
  {
    "key": "cat-17",
    "labelVi": "18. Liên hệ và báo cáo vấn đề",
    "labelEn": "18. Liên hệ và báo cáo vấn đề"
  },
  {
    "key": "cat-18",
    "labelVi": "19. Thuật ngữ và cách diễn giải",
    "labelEn": "19. Thuật ngữ và cách diễn giải"
  },
  {
    "key": "cat-19",
    "labelVi": "20. Điều kiện sử dụng tài khoản",
    "labelEn": "20. Điều kiện sử dụng tài khoản"
  },
  {
    "key": "cat-20",
    "labelVi": "21. Tiêu chuẩn an toàn và tôn trọng",
    "labelEn": "21. Tiêu chuẩn an toàn và tôn trọng"
  },
  {
    "key": "cat-21",
    "labelVi": "22. Tính toàn vẹn và hành vi xác thực",
    "labelEn": "22. Tính toàn vẹn và hành vi xác thực"
  },
  {
    "key": "cat-22",
    "labelVi": "23. Quy tắc về nội dung và quyền của người khác",
    "labelEn": "23. Quy tắc về nội dung và quyền của người khác"
  },
  {
    "key": "cat-23",
    "labelVi": "24. Quy tắc theo từng chức năng",
    "labelEn": "24. Quy tắc theo từng chức năng"
  },
  {
    "key": "cat-24",
    "labelVi": "25. Chính sách dành cho API và tích hợp",
    "labelEn": "25. Chính sách dành cho API và tích hợp"
  },
  {
    "key": "cat-25",
    "labelVi": "26. Báo cáo nội dung và hành vi vi phạm",
    "labelEn": "26. Báo cáo nội dung và hành vi vi phạm"
  },
  {
    "key": "cat-26",
    "labelVi": "27. Nguyên tắc thực thi",
    "labelEn": "27. Nguyên tắc thực thi"
  },
  {
    "key": "cat-27",
    "labelVi": "28. Kháng nghị và sửa sai",
    "labelEn": "28. Kháng nghị và sửa sai"
  },
  {
    "key": "cat-28",
    "labelVi": "29. Tình huống minh họa",
    "labelEn": "29. Tình huống minh họa"
  },
  {
    "key": "cat-29",
    "labelVi": "30. Những gì Fakebook chưa cam kết",
    "labelEn": "30. Những gì Fakebook chưa cam kết"
  },
  {
    "key": "cat-30",
    "labelVi": "31. Checklist vận hành trước khi công khai",
    "labelEn": "31. Checklist vận hành trước khi công khai"
  }
].map(item => ({
  ...item,
  icon: <FaInfoCircle />,
  color: "#1877f2"
}));

export const POLICY_ARTICLES = [
  {
    "id": "cat-0-content",
    "titleVi": "1. Mục đích",
    "titleEn": "1. Mục đích",
    "htmlVi": "<p>Fakebook được xây dựng để cung cấp một không gian mạng xã hội nhẹ, dễ hiểu và chú trọng quyền riêng tư. Chính sách này đặt ra các quy tắc cơ bản cho việc sử dụng tài khoản, đăng nội dung, tương tác, kết nối bạn bè, nhắn tin, tìm kiếm, dùng đề xuất nội dung, tải tệp và sử dụng chức năng Premium khi được bật.</p>\n<p>Mục tiêu của chính sách là:</p>\n<ul>\n<li>Bảo vệ người dùng khỏi truy cập trái phép và hành vi lạm dụng;</li>\n<li>Duy trì trải nghiệm tập trung vào kết nối xã hội có ý nghĩa;</li>\n<li>Bảo đảm cài đặt quyền riêng tư được tôn trọng;</li>\n<li>Giảm spam, giả mạo, gian lận và thao túng hệ thống;</li>\n<li>Xác định rõ giới hạn của nguyên mẫu học thuật.</li>\n</ul>\n",
    "htmlEn": "<p>Fakebook được xây dựng để cung cấp một không gian mạng xã hội nhẹ, dễ hiểu và chú trọng quyền riêng tư. Chính sách này đặt ra các quy tắc cơ bản cho việc sử dụng tài khoản, đăng nội dung, tương tác, kết nối bạn bè, nhắn tin, tìm kiếm, dùng đề xuất nội dung, tải tệp và sử dụng chức năng Premium khi được bật.</p>\n<p>Mục tiêu của chính sách là:</p>\n<ul>\n<li>Bảo vệ người dùng khỏi truy cập trái phép và hành vi lạm dụng;</li>\n<li>Duy trì trải nghiệm tập trung vào kết nối xã hội có ý nghĩa;</li>\n<li>Bảo đảm cài đặt quyền riêng tư được tôn trọng;</li>\n<li>Giảm spam, giả mạo, gian lận và thao túng hệ thống;</li>\n<li>Xác định rõ giới hạn của nguyên mẫu học thuật.</li>\n</ul>\n",
    "section": "cat-0"
  },
  {
    "id": "cat-1-content",
    "titleVi": "2. Phạm vi áp dụng",
    "titleEn": "2. Phạm vi áp dụng",
    "htmlVi": "<p>Chính sách áp dụng cho:</p>\n<ul>\n<li>Khách truy cập chưa đăng nhập;</li>\n<li>Người dùng đã đăng ký;</li>\n<li>Nội dung và tệp được tải lên;</li>\n<li>Bài viết, bình luận, phản ứng và chia sẻ;</li>\n<li>Yêu cầu kết bạn, theo dõi và chặn;</li>\n<li>Hội thoại và tin nhắn;</li>\n<li>Tìm kiếm và nội dung đề xuất;</li>\n<li>Thông báo;</li>\n<li>Đơn hàng và trạng thái Premium khi tính năng thanh toán được bật;</li>\n<li>Mọi yêu cầu gửi đến API, dịch vụ tải lên hoặc dịch vụ nội bộ.</li>\n</ul>\n",
    "htmlEn": "<p>Chính sách áp dụng cho:</p>\n<ul>\n<li>Khách truy cập chưa đăng nhập;</li>\n<li>Người dùng đã đăng ký;</li>\n<li>Nội dung và tệp được tải lên;</li>\n<li>Bài viết, bình luận, phản ứng và chia sẻ;</li>\n<li>Yêu cầu kết bạn, theo dõi và chặn;</li>\n<li>Hội thoại và tin nhắn;</li>\n<li>Tìm kiếm và nội dung đề xuất;</li>\n<li>Thông báo;</li>\n<li>Đơn hàng và trạng thái Premium khi tính năng thanh toán được bật;</li>\n<li>Mọi yêu cầu gửi đến API, dịch vụ tải lên hoặc dịch vụ nội bộ.</li>\n</ul>\n",
    "section": "cat-1"
  },
  {
    "id": "cat-2-content",
    "titleVi": "3. Nguyên tắc cộng đồng",
    "titleEn": "3. Nguyên tắc cộng đồng",
    "htmlVi": "<p>Người dùng Fakebook được kỳ vọng:</p>\n<ol>\n<li>Sử dụng danh tính và tài khoản một cách trung thực;</li>\n<li>Tôn trọng quyền riêng tư và đối tượng xem của người khác;</li>\n<li>Không tìm cách vượt qua cơ chế chặn, quyền sở hữu hoặc phân quyền;</li>\n<li>Không đăng hoặc gửi nội dung gây hại, lừa đảo hoặc trái pháp luật;</li>\n<li>Không phát tán phần mềm độc hại hoặc tệp nguy hiểm;</li>\n<li>Không thao túng lượt tương tác, tìm kiếm, đề xuất hoặc thanh toán;</li>\n<li>Không truy cập dữ liệu, hội thoại hoặc tài nguyên không thuộc quyền của mình;</li>\n<li>Không làm gián đoạn hoặc tiêu thụ tài nguyên hệ thống một cách bất thường.</li>\n</ol>\n",
    "htmlEn": "<p>Người dùng Fakebook được kỳ vọng:</p>\n<ol>\n<li>Sử dụng danh tính và tài khoản một cách trung thực;</li>\n<li>Tôn trọng quyền riêng tư và đối tượng xem của người khác;</li>\n<li>Không tìm cách vượt qua cơ chế chặn, quyền sở hữu hoặc phân quyền;</li>\n<li>Không đăng hoặc gửi nội dung gây hại, lừa đảo hoặc trái pháp luật;</li>\n<li>Không phát tán phần mềm độc hại hoặc tệp nguy hiểm;</li>\n<li>Không thao túng lượt tương tác, tìm kiếm, đề xuất hoặc thanh toán;</li>\n<li>Không truy cập dữ liệu, hội thoại hoặc tài nguyên không thuộc quyền của mình;</li>\n<li>Không làm gián đoạn hoặc tiêu thụ tài nguyên hệ thống một cách bất thường.</li>\n</ol>\n",
    "section": "cat-2"
  },
  {
    "id": "cat-3-content",
    "titleVi": "4. Tài khoản và bảo mật đăng nhập",
    "titleEn": "4. Tài khoản và bảo mật đăng nhập",
    "htmlVi": "<h3>4.1. Tạo tài khoản</h3>\n<p>Khi đăng ký, bạn phải cung cấp email hợp lệ và mật khẩu đáp ứng yêu cầu của hệ thống. Email trùng, dữ liệu sai định dạng hoặc đầu vào không hợp lệ có thể bị từ chối.</p>\n<p>Bạn chịu trách nhiệm giữ an toàn cho thông tin đăng nhập và thiết bị của mình.</p>\n<h3>4.2. Phiên đăng nhập</h3>\n<p>Fakebook có thể duy trì nhiều phiên trên nhiều thiết bị. Bạn nên:</p>\n<ul>\n<li>Đăng xuất khỏi thiết bị dùng chung;</li>\n<li>Kiểm tra danh sách phiên nếu giao diện hỗ trợ;</li>\n<li>Thu hồi phiên lạ;</li>\n<li>Đổi mật khẩu khi nghi ngờ bị lộ;</li>\n<li>Không chia sẻ access token, refresh token hoặc liên kết xác thực.</li>\n</ul>\n<h3>4.3. Hành vi bị cấm liên quan đến tài khoản</h3>\n<p>Không được:</p>\n<ul>\n<li>Truy cập tài khoản của người khác khi chưa được phép;</li>\n<li>Giả mạo người dùng, nhóm dự án hoặc đơn vị vận hành;</li>\n<li>Dùng dữ liệu đăng nhập bị đánh cắp;</li>\n<li>Cố gắng đoán mật khẩu, brute-force hoặc né rate limit;</li>\n<li>Chỉnh sửa header nội bộ để giả danh người dùng khác;</li>\n<li>Khai thác phiên đã bị thu hồi hoặc token hết hạn;</li>\n<li>Tạo tài khoản hàng loạt để spam hoặc thao túng tương tác.</li>\n</ul>\n",
    "htmlEn": "<h3>4.1. Tạo tài khoản</h3>\n<p>Khi đăng ký, bạn phải cung cấp email hợp lệ và mật khẩu đáp ứng yêu cầu của hệ thống. Email trùng, dữ liệu sai định dạng hoặc đầu vào không hợp lệ có thể bị từ chối.</p>\n<p>Bạn chịu trách nhiệm giữ an toàn cho thông tin đăng nhập và thiết bị của mình.</p>\n<h3>4.2. Phiên đăng nhập</h3>\n<p>Fakebook có thể duy trì nhiều phiên trên nhiều thiết bị. Bạn nên:</p>\n<ul>\n<li>Đăng xuất khỏi thiết bị dùng chung;</li>\n<li>Kiểm tra danh sách phiên nếu giao diện hỗ trợ;</li>\n<li>Thu hồi phiên lạ;</li>\n<li>Đổi mật khẩu khi nghi ngờ bị lộ;</li>\n<li>Không chia sẻ access token, refresh token hoặc liên kết xác thực.</li>\n</ul>\n<h3>4.3. Hành vi bị cấm liên quan đến tài khoản</h3>\n<p>Không được:</p>\n<ul>\n<li>Truy cập tài khoản của người khác khi chưa được phép;</li>\n<li>Giả mạo người dùng, nhóm dự án hoặc đơn vị vận hành;</li>\n<li>Dùng dữ liệu đăng nhập bị đánh cắp;</li>\n<li>Cố gắng đoán mật khẩu, brute-force hoặc né rate limit;</li>\n<li>Chỉnh sửa header nội bộ để giả danh người dùng khác;</li>\n<li>Khai thác phiên đã bị thu hồi hoặc token hết hạn;</li>\n<li>Tạo tài khoản hàng loạt để spam hoặc thao túng tương tác.</li>\n</ul>\n",
    "section": "cat-3"
  },
  {
    "id": "cat-4-content",
    "titleVi": "5. Nội dung người dùng",
    "titleEn": "5. Nội dung người dùng",
    "htmlVi": "<h3>5.1. Trách nhiệm với nội dung</h3>\n<p>Bạn chịu trách nhiệm về nội dung mình đăng, bình luận, gửi hoặc tải lên. Trước khi chia sẻ, bạn cần bảo đảm mình có quyền sử dụng nội dung đó và không xâm phạm quyền của người khác.</p>\n<p>Fakebook cần quyền kỹ thuật giới hạn để lưu trữ, xử lý, hiển thị và truyền nội dung theo chức năng bạn sử dụng và đối tượng xem bạn đã chọn. Quyền kỹ thuật này chỉ nhằm vận hành dịch vụ trong phạm vi sản phẩm.</p>\n<h3>5.2. Nội dung không được phép</h3>\n<p>Không đăng hoặc gửi:</p>\n<ul>\n<li>Nội dung trái pháp luật;</li>\n<li>Nội dung đe dọa, quấy rối hoặc kích động gây hại;</li>\n<li>Nội dung tiết lộ thông tin riêng tư của người khác khi chưa được phép;</li>\n<li>Nội dung lừa đảo, giả mạo hoặc dẫn dụ lấy thông tin đăng nhập;</li>\n<li>Phần mềm độc hại, mã thực thi nguy hiểm hoặc tệp có script độc hại;</li>\n<li>Nội dung nhằm khai thác lỗ hổng hoặc vượt qua cơ chế bảo vệ;</li>\n<li>Spam, chuỗi tin nhắn hàng loạt hoặc nội dung lặp lại bất thường;</li>\n<li>Nội dung dùng để thao túng lượt thích, lượt xem, bình luận, tìm kiếm hoặc đề xuất;</li>\n<li>Nội dung vi phạm quyền sở hữu trí tuệ của người khác.</li>\n</ul>\n<h3>5.3. Tệp phương tiện</h3>\n<p>Tệp tải lên phải:</p>\n<ul>\n<li>Thuộc loại được hệ thống hỗ trợ;</li>\n<li>Không vượt giới hạn kích thước;</li>\n<li>Có phần mở rộng, MIME type và chữ ký nhị phân phù hợp;</li>\n<li>Không chứa mã thực thi hoặc nội dung nguy hiểm;</li>\n<li>Không sử dụng tên hoặc đường dẫn nhằm truy cập ngoài vùng lưu trữ cho phép.</li>\n</ul>\n<p>Tệp không vượt qua kiểm tra có thể bị từ chối. Tệp tạm không được gắn với nội dung có thể bị dọn dẹp tự động.</p>\n",
    "htmlEn": "<h3>5.1. Trách nhiệm với nội dung</h3>\n<p>Bạn chịu trách nhiệm về nội dung mình đăng, bình luận, gửi hoặc tải lên. Trước khi chia sẻ, bạn cần bảo đảm mình có quyền sử dụng nội dung đó và không xâm phạm quyền của người khác.</p>\n<p>Fakebook cần quyền kỹ thuật giới hạn để lưu trữ, xử lý, hiển thị và truyền nội dung theo chức năng bạn sử dụng và đối tượng xem bạn đã chọn. Quyền kỹ thuật này chỉ nhằm vận hành dịch vụ trong phạm vi sản phẩm.</p>\n<h3>5.2. Nội dung không được phép</h3>\n<p>Không đăng hoặc gửi:</p>\n<ul>\n<li>Nội dung trái pháp luật;</li>\n<li>Nội dung đe dọa, quấy rối hoặc kích động gây hại;</li>\n<li>Nội dung tiết lộ thông tin riêng tư của người khác khi chưa được phép;</li>\n<li>Nội dung lừa đảo, giả mạo hoặc dẫn dụ lấy thông tin đăng nhập;</li>\n<li>Phần mềm độc hại, mã thực thi nguy hiểm hoặc tệp có script độc hại;</li>\n<li>Nội dung nhằm khai thác lỗ hổng hoặc vượt qua cơ chế bảo vệ;</li>\n<li>Spam, chuỗi tin nhắn hàng loạt hoặc nội dung lặp lại bất thường;</li>\n<li>Nội dung dùng để thao túng lượt thích, lượt xem, bình luận, tìm kiếm hoặc đề xuất;</li>\n<li>Nội dung vi phạm quyền sở hữu trí tuệ của người khác.</li>\n</ul>\n<h3>5.3. Tệp phương tiện</h3>\n<p>Tệp tải lên phải:</p>\n<ul>\n<li>Thuộc loại được hệ thống hỗ trợ;</li>\n<li>Không vượt giới hạn kích thước;</li>\n<li>Có phần mở rộng, MIME type và chữ ký nhị phân phù hợp;</li>\n<li>Không chứa mã thực thi hoặc nội dung nguy hiểm;</li>\n<li>Không sử dụng tên hoặc đường dẫn nhằm truy cập ngoài vùng lưu trữ cho phép.</li>\n</ul>\n<p>Tệp không vượt qua kiểm tra có thể bị từ chối. Tệp tạm không được gắn với nội dung có thể bị dọn dẹp tự động.</p>\n",
    "section": "cat-4"
  },
  {
    "id": "cat-5-content",
    "titleVi": "6. Quyền riêng tư và đối tượng xem",
    "titleEn": "6. Quyền riêng tư và đối tượng xem",
    "htmlVi": "<h3>6.1. Các mức hiển thị</h3>\n<p>Fakebook hỗ trợ các lựa chọn cơ bản:</p>\n<ul>\n<li>Công khai;</li>\n<li>Bạn bè và người theo dõi;</li>\n<li>Chỉ bạn bè;</li>\n<li>Chỉ mình tôi.</li>\n</ul>\n<p>Bạn phải kiểm tra đối tượng hiển thị trước khi đăng. Hệ thống có trách nhiệm lưu cài đặt này cùng bài viết và ngăn người ngoài đối tượng truy cập.</p>\n<h3>6.2. Không được vượt qua cài đặt quyền riêng tư</h3>\n<p>Không được:</p>\n<ul>\n<li>Tìm cách truy cập bài viết bị hạn chế bằng API, URL trực tiếp hoặc mã đối tượng;</li>\n<li>Sử dụng tài khoản khác để né trạng thái chặn;</li>\n<li>Khai thác kết quả tìm kiếm hoặc đề xuất để xem nội dung không được phép;</li>\n<li>Chia sẻ lại nội dung riêng tư ra ngoài phạm vi mà chủ nội dung dự kiến, nếu việc đó xâm phạm quyền riêng tư hoặc pháp luật.</li>\n</ul>\n<h3>6.3. Giới hạn hiện tại</h3>\n<p>Mô hình quyền riêng tư hiện tại chưa hỗ trợ đầy đủ:</p>\n<ul>\n<li>Danh sách bạn bè tùy chỉnh;</li>\n<li>“Bạn bè ngoại trừ…”;</li>\n<li>Quy tắc phức tạp theo nhóm người;</li>\n<li>Các vai trò kiểm duyệt cộng đồng nâng cao.</li>\n</ul>\n",
    "htmlEn": "<h3>6.1. Các mức hiển thị</h3>\n<p>Fakebook hỗ trợ các lựa chọn cơ bản:</p>\n<ul>\n<li>Công khai;</li>\n<li>Bạn bè và người theo dõi;</li>\n<li>Chỉ bạn bè;</li>\n<li>Chỉ mình tôi.</li>\n</ul>\n<p>Bạn phải kiểm tra đối tượng hiển thị trước khi đăng. Hệ thống có trách nhiệm lưu cài đặt này cùng bài viết và ngăn người ngoài đối tượng truy cập.</p>\n<h3>6.2. Không được vượt qua cài đặt quyền riêng tư</h3>\n<p>Không được:</p>\n<ul>\n<li>Tìm cách truy cập bài viết bị hạn chế bằng API, URL trực tiếp hoặc mã đối tượng;</li>\n<li>Sử dụng tài khoản khác để né trạng thái chặn;</li>\n<li>Khai thác kết quả tìm kiếm hoặc đề xuất để xem nội dung không được phép;</li>\n<li>Chia sẻ lại nội dung riêng tư ra ngoài phạm vi mà chủ nội dung dự kiến, nếu việc đó xâm phạm quyền riêng tư hoặc pháp luật.</li>\n</ul>\n<h3>6.3. Giới hạn hiện tại</h3>\n<p>Mô hình quyền riêng tư hiện tại chưa hỗ trợ đầy đủ:</p>\n<ul>\n<li>Danh sách bạn bè tùy chỉnh;</li>\n<li>“Bạn bè ngoại trừ…”;</li>\n<li>Quy tắc phức tạp theo nhóm người;</li>\n<li>Các vai trò kiểm duyệt cộng đồng nâng cao.</li>\n</ul>\n",
    "section": "cat-5"
  },
  {
    "id": "cat-6-content",
    "titleVi": "7. Bạn bè, theo dõi và chặn",
    "titleEn": "7. Bạn bè, theo dõi và chặn",
    "htmlVi": "<p>Bạn có thể gửi, nhận, chấp nhận, từ chối hoặc xóa yêu cầu kết bạn khi chức năng tương ứng khả dụng.</p>\n<p>Không được:</p>\n<ul>\n<li>Gửi yêu cầu kết bạn hàng loạt để spam;</li>\n<li>Liên tục gửi lại yêu cầu sau khi bị từ chối;</li>\n<li>Dùng nhiều tài khoản để né chặn;</li>\n<li>Quấy rối người dùng thông qua bình luận, tin nhắn hoặc yêu cầu kết nối;</li>\n<li>Lợi dụng quan hệ xã hội để lấy dữ liệu riêng tư.</li>\n</ul>\n<p>Khi một người dùng bị chặn, các tương tác thuộc chính sách chặn phải bị từ chối.</p>\n",
    "htmlEn": "<p>Bạn có thể gửi, nhận, chấp nhận, từ chối hoặc xóa yêu cầu kết bạn khi chức năng tương ứng khả dụng.</p>\n<p>Không được:</p>\n<ul>\n<li>Gửi yêu cầu kết bạn hàng loạt để spam;</li>\n<li>Liên tục gửi lại yêu cầu sau khi bị từ chối;</li>\n<li>Dùng nhiều tài khoản để né chặn;</li>\n<li>Quấy rối người dùng thông qua bình luận, tin nhắn hoặc yêu cầu kết nối;</li>\n<li>Lợi dụng quan hệ xã hội để lấy dữ liệu riêng tư.</li>\n</ul>\n<p>Khi một người dùng bị chặn, các tương tác thuộc chính sách chặn phải bị từ chối.</p>\n",
    "section": "cat-6"
  },
  {
    "id": "cat-7-content",
    "titleVi": "8. Tin nhắn và hội thoại",
    "titleEn": "8. Tin nhắn và hội thoại",
    "htmlVi": "<h3>8.1. Quyền truy cập</h3>\n<p>Chỉ người tham gia hợp lệ mới được đọc hoặc gửi tin trong hội thoại riêng. Một mã hội thoại hoặc mã tin nhắn không tạo quyền truy cập.</p>\n<h3>8.2. Hành vi bị cấm</h3>\n<p>Không được:</p>\n<ul>\n<li>Thêm hoặc truy cập người tham gia trái phép;</li>\n<li>Gửi spam, lừa đảo hoặc phần mềm độc hại;</li>\n<li>Sử dụng tin nhắn để quấy rối hoặc đe dọa;</li>\n<li>Cố gắng sửa trạng thái đọc, thứ tự tin nhắn hoặc dữ liệu hội thoại của người khác;</li>\n<li>Lợi dụng gửi lại yêu cầu để tạo nhiều bản sao tin nhắn.</li>\n</ul>\n<h3>8.3. Trạng thái gửi và đọc</h3>\n<p>Fakebook có thể lưu trạng thái gửi, nhận và đã đọc để đồng bộ hội thoại. Các giá trị này được quản lý theo thứ tự hội thoại và quyền sở hữu.</p>\n",
    "htmlEn": "<h3>8.1. Quyền truy cập</h3>\n<p>Chỉ người tham gia hợp lệ mới được đọc hoặc gửi tin trong hội thoại riêng. Một mã hội thoại hoặc mã tin nhắn không tạo quyền truy cập.</p>\n<h3>8.2. Hành vi bị cấm</h3>\n<p>Không được:</p>\n<ul>\n<li>Thêm hoặc truy cập người tham gia trái phép;</li>\n<li>Gửi spam, lừa đảo hoặc phần mềm độc hại;</li>\n<li>Sử dụng tin nhắn để quấy rối hoặc đe dọa;</li>\n<li>Cố gắng sửa trạng thái đọc, thứ tự tin nhắn hoặc dữ liệu hội thoại của người khác;</li>\n<li>Lợi dụng gửi lại yêu cầu để tạo nhiều bản sao tin nhắn.</li>\n</ul>\n<h3>8.3. Trạng thái gửi và đọc</h3>\n<p>Fakebook có thể lưu trạng thái gửi, nhận và đã đọc để đồng bộ hội thoại. Các giá trị này được quản lý theo thứ tự hội thoại và quyền sở hữu.</p>\n",
    "section": "cat-7"
  },
  {
    "id": "cat-8-content",
    "titleVi": "9. Tìm kiếm và khám phá",
    "titleEn": "9. Tìm kiếm và khám phá",
    "htmlVi": "<p>Fakebook hỗ trợ tìm kiếm các đối tượng được hệ thống định nghĩa, có thể gồm người dùng, nhóm, bài viết và các loại nội dung xã hội khác.</p>\n<p>Không được:</p>\n<ul>\n<li>Tự động gửi khối lượng lớn truy vấn;</li>\n<li>Thu thập hàng loạt hồ sơ hoặc nội dung;</li>\n<li>Cố tình lặp lựa chọn kết quả để thao túng xếp hạng;</li>\n<li>Dùng truy vấn nhằm dò tìm nội dung riêng tư;</li>\n<li>Khai thác lỗi lập chỉ mục để truy cập đối tượng đã xóa hoặc bị hạn chế.</li>\n</ul>\n<p>Kết quả tìm kiếm có thể thay đổi theo chỉ mục, mức độ liên quan, dữ liệu tương tác và quyền truy cập tại thời điểm truy vấn.</p>\n",
    "htmlEn": "<p>Fakebook hỗ trợ tìm kiếm các đối tượng được hệ thống định nghĩa, có thể gồm người dùng, nhóm, bài viết và các loại nội dung xã hội khác.</p>\n<p>Không được:</p>\n<ul>\n<li>Tự động gửi khối lượng lớn truy vấn;</li>\n<li>Thu thập hàng loạt hồ sơ hoặc nội dung;</li>\n<li>Cố tình lặp lựa chọn kết quả để thao túng xếp hạng;</li>\n<li>Dùng truy vấn nhằm dò tìm nội dung riêng tư;</li>\n<li>Khai thác lỗi lập chỉ mục để truy cập đối tượng đã xóa hoặc bị hạn chế.</li>\n</ul>\n<p>Kết quả tìm kiếm có thể thay đổi theo chỉ mục, mức độ liên quan, dữ liệu tương tác và quyền truy cập tại thời điểm truy vấn.</p>\n",
    "section": "cat-8"
  },
  {
    "id": "cat-9-content",
    "titleVi": "10. Bảng tin và nội dung đề xuất",
    "titleEn": "10. Bảng tin và nội dung đề xuất",
    "htmlVi": "<p>Fakebook có thể xếp hạng bài viết dựa trên dữ liệu người dùng, nội dung và tương tác. Hệ thống không cam kết rằng mọi bài viết đều được phân phối hoặc xuất hiện theo thứ tự thời gian tuyệt đối.</p>\n<p>Nội dung đề xuất phải được lọc theo quyền riêng tư và quan hệ xã hội trước khi hiển thị.</p>\n<p>Không được:</p>\n<ul>\n<li>Tạo tương tác giả;</li>\n<li>Dùng bot để thích, lưu, chia sẻ, xem hoặc bình luận hàng loạt;</li>\n<li>Lặp sự kiện với mục đích thay đổi vector người dùng hoặc xếp hạng;</li>\n<li>Khai thác idempotency key hoặc API nội bộ để ghi nhận tương tác trái phép.</li>\n</ul>\n",
    "htmlEn": "<p>Fakebook có thể xếp hạng bài viết dựa trên dữ liệu người dùng, nội dung và tương tác. Hệ thống không cam kết rằng mọi bài viết đều được phân phối hoặc xuất hiện theo thứ tự thời gian tuyệt đối.</p>\n<p>Nội dung đề xuất phải được lọc theo quyền riêng tư và quan hệ xã hội trước khi hiển thị.</p>\n<p>Không được:</p>\n<ul>\n<li>Tạo tương tác giả;</li>\n<li>Dùng bot để thích, lưu, chia sẻ, xem hoặc bình luận hàng loạt;</li>\n<li>Lặp sự kiện với mục đích thay đổi vector người dùng hoặc xếp hạng;</li>\n<li>Khai thác idempotency key hoặc API nội bộ để ghi nhận tương tác trái phép.</li>\n</ul>\n",
    "section": "cat-9"
  },
  {
    "id": "cat-10-content",
    "titleVi": "11. Thông báo",
    "titleEn": "11. Thông báo",
    "htmlVi": "<p>Fakebook có thể tạo thông báo cho các sự kiện được hỗ trợ như yêu cầu kết bạn, tin nhắn và hoạt động xã hội khác.</p>\n<p>Bạn không được:</p>\n<ul>\n<li>Tạo sự kiện giả để làm phiền người nhận;</li>\n<li>Gửi lặp cùng một yêu cầu để tạo thông báo trùng;</li>\n<li>Cố đọc hoặc sửa thông báo của người khác;</li>\n<li>Dùng mã thông báo của người khác để suy đoán dữ liệu riêng tư.</li>\n</ul>\n<p>Thông báo có thể được xóa sau thời hạn lưu trữ cấu hình.</p>\n",
    "htmlEn": "<p>Fakebook có thể tạo thông báo cho các sự kiện được hỗ trợ như yêu cầu kết bạn, tin nhắn và hoạt động xã hội khác.</p>\n<p>Bạn không được:</p>\n<ul>\n<li>Tạo sự kiện giả để làm phiền người nhận;</li>\n<li>Gửi lặp cùng một yêu cầu để tạo thông báo trùng;</li>\n<li>Cố đọc hoặc sửa thông báo của người khác;</li>\n<li>Dùng mã thông báo của người khác để suy đoán dữ liệu riêng tư.</li>\n</ul>\n<p>Thông báo có thể được xóa sau thời hạn lưu trữ cấu hình.</p>\n",
    "section": "cat-10"
  },
  {
    "id": "cat-11-content",
    "titleVi": "12. Premium và thanh toán",
    "titleEn": "12. Premium và thanh toán",
    "htmlVi": "<h3>12.1. Phạm vi tính năng</h3>\n<p>Khi được bật, Fakebook có thể cung cấp gói Premium và tạo đơn hàng thông qua nhà cung cấp thanh toán được cấu hình.</p>\n<p>Phiên bản trong báo cáo là nguyên mẫu học thuật. Chức năng thanh toán có thể bị tắt mặc định và không được coi là nền tảng thanh toán thương mại hoàn chỉnh.</p>\n<h3>12.2. Quy tắc sử dụng</h3>\n<p>Không được:</p>\n<ul>\n<li>Giả mạo webhook hoặc trạng thái thanh toán;</li>\n<li>Sửa số tiền, gói đăng ký hoặc người dùng sở hữu đơn hàng;</li>\n<li>Gửi nhiều yêu cầu nhằm tạo đơn trùng;</li>\n<li>Sử dụng thông tin thanh toán không hợp pháp;</li>\n<li>Yêu cầu kích hoạt Premium khi giao dịch chưa được nhà cung cấp xác nhận.</li>\n</ul>\n<p>Trạng thái “đã thanh toán” chỉ được chấp nhận từ webhook đã xác minh. Trang trình duyệt quay lại sau thanh toán không tự chứng minh giao dịch thành công.</p>\n<h3>12.3. Hạn chế</h3>\n<p>Phiên bản hiện tại chưa cung cấp đầy đủ:</p>\n<ul>\n<li>Hoàn tiền;</li>\n<li>Đối soát tài chính hoàn chỉnh;</li>\n<li>Báo cáo tài chính;</li>\n<li>Xử lý sự cố thanh toán cấp sản phẩm thương mại;</li>\n<li>Cam kết SLA thanh toán.</li>\n</ul>\n",
    "htmlEn": "<h3>12.1. Phạm vi tính năng</h3>\n<p>Khi được bật, Fakebook có thể cung cấp gói Premium và tạo đơn hàng thông qua nhà cung cấp thanh toán được cấu hình.</p>\n<p>Phiên bản trong báo cáo là nguyên mẫu học thuật. Chức năng thanh toán có thể bị tắt mặc định và không được coi là nền tảng thanh toán thương mại hoàn chỉnh.</p>\n<h3>12.2. Quy tắc sử dụng</h3>\n<p>Không được:</p>\n<ul>\n<li>Giả mạo webhook hoặc trạng thái thanh toán;</li>\n<li>Sửa số tiền, gói đăng ký hoặc người dùng sở hữu đơn hàng;</li>\n<li>Gửi nhiều yêu cầu nhằm tạo đơn trùng;</li>\n<li>Sử dụng thông tin thanh toán không hợp pháp;</li>\n<li>Yêu cầu kích hoạt Premium khi giao dịch chưa được nhà cung cấp xác nhận.</li>\n</ul>\n<p>Trạng thái “đã thanh toán” chỉ được chấp nhận từ webhook đã xác minh. Trang trình duyệt quay lại sau thanh toán không tự chứng minh giao dịch thành công.</p>\n<h3>12.3. Hạn chế</h3>\n<p>Phiên bản hiện tại chưa cung cấp đầy đủ:</p>\n<ul>\n<li>Hoàn tiền;</li>\n<li>Đối soát tài chính hoàn chỉnh;</li>\n<li>Báo cáo tài chính;</li>\n<li>Xử lý sự cố thanh toán cấp sản phẩm thương mại;</li>\n<li>Cam kết SLA thanh toán.</li>\n</ul>\n",
    "section": "cat-11"
  },
  {
    "id": "cat-12-content",
    "titleVi": "13. Bảo vệ hệ thống và API",
    "titleEn": "13. Bảo vệ hệ thống và API",
    "htmlVi": "<p>Bạn không được:</p>\n<ul>\n<li>Quét lỗ hổng hoặc thử xâm nhập khi chưa được cho phép;</li>\n<li>Vượt qua API Gateway;</li>\n<li>Giả mạo <code>X-User-Id</code>, <code>X-Session-Id</code> hoặc header dịch vụ;</li>\n<li>Đánh cắp hoặc tái sử dụng bí mật Gateway, HMAC hoặc khóa JWT;</li>\n<li>Gửi nonce, timestamp hoặc chữ ký giả;</li>\n<li>Khai thác CORS, đường dẫn tệp, truy vấn GraphQL hoặc endpoint nội bộ;</li>\n<li>Gây từ chối dịch vụ;</li>\n<li>Cố tình tạo ngoại lệ để lấy stack trace, khóa bí mật hoặc cấu hình;</li>\n<li>Gửi đầu vào vượt giới hạn phân trang, độ dài, kích thước tệp hoặc số lượng yêu cầu.</li>\n</ul>\n<p>Rate limiting, validation, idempotency và middleware bảo mật có thể từ chối hoặc làm chậm yêu cầu bất thường.</p>\n",
    "htmlEn": "<p>Bạn không được:</p>\n<ul>\n<li>Quét lỗ hổng hoặc thử xâm nhập khi chưa được cho phép;</li>\n<li>Vượt qua API Gateway;</li>\n<li>Giả mạo <code>X-User-Id</code>, <code>X-Session-Id</code> hoặc header dịch vụ;</li>\n<li>Đánh cắp hoặc tái sử dụng bí mật Gateway, HMAC hoặc khóa JWT;</li>\n<li>Gửi nonce, timestamp hoặc chữ ký giả;</li>\n<li>Khai thác CORS, đường dẫn tệp, truy vấn GraphQL hoặc endpoint nội bộ;</li>\n<li>Gây từ chối dịch vụ;</li>\n<li>Cố tình tạo ngoại lệ để lấy stack trace, khóa bí mật hoặc cấu hình;</li>\n<li>Gửi đầu vào vượt giới hạn phân trang, độ dài, kích thước tệp hoặc số lượng yêu cầu.</li>\n</ul>\n<p>Rate limiting, validation, idempotency và middleware bảo mật có thể từ chối hoặc làm chậm yêu cầu bất thường.</p>\n",
    "section": "cat-12"
  },
  {
    "id": "cat-13-content",
    "titleVi": "14. Thực thi chính sách",
    "titleEn": "14. Thực thi chính sách",
    "htmlVi": "<p>Báo cáo dự án không mô tả hệ thống kiểm duyệt doanh nghiệp, quy trình báo cáo nội dung hoàn chỉnh hoặc cơ chế kháng nghị tự động. Vì vậy, trong phiên bản hiện tại:</p>\n<ul>\n<li>Phần lớn quy tắc được thực thi bằng xác thực, phân quyền, kiểm tra quyền sở hữu, chặn, validation, rate limiting và giới hạn API;</li>\n<li>Việc xử lý nội dung vi phạm có thể cần can thiệp thủ công của nhóm phát triển hoặc đơn vị vận hành;</li>\n<li>Khả năng phát hiện tự động nội dung vi phạm còn hạn chế;</li>\n<li>Không nên quảng bá Fakebook như một nền tảng đã có hệ thống kiểm duyệt quy mô thương mại.</li>\n</ul>\n<p>Trước khi phát hành công khai, cần bổ sung:</p>\n<ul>\n<li>Nút báo cáo người dùng và nội dung;</li>\n<li>Quy trình xem xét;</li>\n<li>Vai trò quản trị viên và kiểm duyệt viên;</li>\n<li>Cơ chế khiếu nại;</li>\n<li>Nhật ký kiểm toán;</li>\n<li>Quy tắc xử lý tái phạm;</li>\n<li>Thời gian phản hồi và kênh liên hệ.</li>\n</ul>\n",
    "htmlEn": "<p>Báo cáo dự án không mô tả hệ thống kiểm duyệt doanh nghiệp, quy trình báo cáo nội dung hoàn chỉnh hoặc cơ chế kháng nghị tự động. Vì vậy, trong phiên bản hiện tại:</p>\n<ul>\n<li>Phần lớn quy tắc được thực thi bằng xác thực, phân quyền, kiểm tra quyền sở hữu, chặn, validation, rate limiting và giới hạn API;</li>\n<li>Việc xử lý nội dung vi phạm có thể cần can thiệp thủ công của nhóm phát triển hoặc đơn vị vận hành;</li>\n<li>Khả năng phát hiện tự động nội dung vi phạm còn hạn chế;</li>\n<li>Không nên quảng bá Fakebook như một nền tảng đã có hệ thống kiểm duyệt quy mô thương mại.</li>\n</ul>\n<p>Trước khi phát hành công khai, cần bổ sung:</p>\n<ul>\n<li>Nút báo cáo người dùng và nội dung;</li>\n<li>Quy trình xem xét;</li>\n<li>Vai trò quản trị viên và kiểm duyệt viên;</li>\n<li>Cơ chế khiếu nại;</li>\n<li>Nhật ký kiểm toán;</li>\n<li>Quy tắc xử lý tái phạm;</li>\n<li>Thời gian phản hồi và kênh liên hệ.</li>\n</ul>\n",
    "section": "cat-13"
  },
  {
    "id": "cat-14-content",
    "titleVi": "15. Hạn chế dịch vụ",
    "titleEn": "15. Hạn chế dịch vụ",
    "htmlVi": "<p>Fakebook là nguyên mẫu học thuật và chưa được xác nhận cho tải thương mại quy mô lớn. Dịch vụ có thể:</p>\n<ul>\n<li>Gián đoạn;</li>\n<li>Mất kết nối thời gian thực;</li>\n<li>Chưa hỗ trợ mọi thiết bị hoặc trình duyệt;</li>\n<li>Có kết quả tìm kiếm hoặc đề xuất chưa tối ưu;</li>\n<li>Chưa có cơ chế dự phòng, failover hoặc mở rộng tự động;</li>\n<li>Chưa có kiểm thử xâm nhập và kiểm thử tải đầy đủ;</li>\n<li>Chưa có hệ thống quan sát tập trung hoàn chỉnh.</li>\n</ul>\n",
    "htmlEn": "<p>Fakebook là nguyên mẫu học thuật và chưa được xác nhận cho tải thương mại quy mô lớn. Dịch vụ có thể:</p>\n<ul>\n<li>Gián đoạn;</li>\n<li>Mất kết nối thời gian thực;</li>\n<li>Chưa hỗ trợ mọi thiết bị hoặc trình duyệt;</li>\n<li>Có kết quả tìm kiếm hoặc đề xuất chưa tối ưu;</li>\n<li>Chưa có cơ chế dự phòng, failover hoặc mở rộng tự động;</li>\n<li>Chưa có kiểm thử xâm nhập và kiểm thử tải đầy đủ;</li>\n<li>Chưa có hệ thống quan sát tập trung hoàn chỉnh.</li>\n</ul>\n",
    "section": "cat-14"
  },
  {
    "id": "cat-15-content",
    "titleVi": "16. Các chức năng không thuộc phạm vi hiện tại",
    "titleEn": "16. Các chức năng không thuộc phạm vi hiện tại",
    "htmlVi": "<p>Chính sách này không mô tả vận hành cho các chức năng chưa được triển khai, bao gồm:</p>\n<ul>\n<li>Livestream;</li>\n<li>Gọi thoại hoặc gọi video;</li>\n<li>Marketplace;</li>\n<li>Quảng cáo thương mại;</li>\n<li>Xác thực sinh trắc học;</li>\n<li>Quản trị cộng đồng quy mô lớn;</li>\n<li>Kiểm duyệt tự động cấp doanh nghiệp;</li>\n<li>Thanh toán thương mại hoàn chỉnh;</li>\n<li>Triển khai đa vùng và độ sẵn sàng cao.</li>\n</ul>\n",
    "htmlEn": "<p>Chính sách này không mô tả vận hành cho các chức năng chưa được triển khai, bao gồm:</p>\n<ul>\n<li>Livestream;</li>\n<li>Gọi thoại hoặc gọi video;</li>\n<li>Marketplace;</li>\n<li>Quảng cáo thương mại;</li>\n<li>Xác thực sinh trắc học;</li>\n<li>Quản trị cộng đồng quy mô lớn;</li>\n<li>Kiểm duyệt tự động cấp doanh nghiệp;</li>\n<li>Thanh toán thương mại hoàn chỉnh;</li>\n<li>Triển khai đa vùng và độ sẵn sàng cao.</li>\n</ul>\n",
    "section": "cat-15"
  },
  {
    "id": "cat-16-content",
    "titleVi": "17. Thay đổi chính sách",
    "titleEn": "17. Thay đổi chính sách",
    "htmlVi": "<p>Chính sách có thể được cập nhật khi tính năng, kiến trúc, cách lưu trữ hoặc quy trình kiểm duyệt thay đổi. Phiên bản và ngày cập nhật phải được công bố rõ.</p>\n",
    "htmlEn": "<p>Chính sách có thể được cập nhật khi tính năng, kiến trúc, cách lưu trữ hoặc quy trình kiểm duyệt thay đổi. Phiên bản và ngày cập nhật phải được công bố rõ.</p>\n",
    "section": "cat-16"
  },
  {
    "id": "cat-17-content",
    "titleVi": "18. Liên hệ và báo cáo vấn đề",
    "titleEn": "18. Liên hệ và báo cáo vấn đề",
    "htmlVi": "<p>Báo cáo dự án chưa cung cấp email hỗ trợ chính thức. Trước khi công khai, phần này cần được thay bằng:</p>\n<ul>\n<li>Email hỗ trợ;</li>\n<li>Kênh báo cáo nội dung;</li>\n<li>Kênh báo cáo lỗi bảo mật;</li>\n<li>Thời gian phản hồi dự kiến;</li>\n<li>Hướng dẫn không gửi mật khẩu, token hoặc bí mật qua email.# Phần mở rộng chuyên sâu về chính sách và tiêu chuẩn cộng đồng</li>\n</ul>\n",
    "htmlEn": "<p>Báo cáo dự án chưa cung cấp email hỗ trợ chính thức. Trước khi công khai, phần này cần được thay bằng:</p>\n<ul>\n<li>Email hỗ trợ;</li>\n<li>Kênh báo cáo nội dung;</li>\n<li>Kênh báo cáo lỗi bảo mật;</li>\n<li>Thời gian phản hồi dự kiến;</li>\n<li>Hướng dẫn không gửi mật khẩu, token hoặc bí mật qua email.# Phần mở rộng chuyên sâu về chính sách và tiêu chuẩn cộng đồng</li>\n</ul>\n",
    "section": "cat-17"
  },
  {
    "id": "cat-18-content",
    "titleVi": "19. Thuật ngữ và cách diễn giải",
    "titleEn": "19. Thuật ngữ và cách diễn giải",
    "htmlVi": "<ul>\n<li><strong>Nội dung</strong> bao gồm bài viết, bình luận, phản ứng, ảnh, video, âm thanh, tài liệu, tên hiển thị, ảnh hồ sơ, tin nhắn và dữ liệu khác do người dùng đưa lên.</li>\n<li><strong>Tương tác</strong> bao gồm thích, phản ứng, bình luận, theo dõi, kết bạn, tìm kiếm, chọn kết quả, gửi tin nhắn và hành động khác được hỗ trợ.</li>\n<li><strong>Lạm dụng</strong> là việc sử dụng chức năng đúng kỹ thuật nhưng sai mục đích, gây hại cho người khác hoặc làm sai lệch hoạt động của hệ thống.</li>\n<li><strong>Vượt quyền</strong> là truy cập, sửa, xóa hoặc suy đoán dữ liệu ngoài quyền sở hữu hoặc đối tượng được phép.</li>\n<li><strong>Thực thi</strong> bao gồm từ chối yêu cầu, ẩn hoặc xóa nội dung, thu hồi phiên, hạn chế tài khoản, vô hiệu hóa tài khoản, chặn tệp hoặc chuyển vụ việc sang xem xét thủ công.</li>\n<li><strong>Bản triển khai công khai</strong> là môi trường được cung cấp cho người dùng ngoài nhóm dự án. Nguyên mẫu chạy local hoặc Docker nội bộ không tự động được coi là dịch vụ thương mại.</li>\n</ul>\n",
    "htmlEn": "<ul>\n<li><strong>Nội dung</strong> bao gồm bài viết, bình luận, phản ứng, ảnh, video, âm thanh, tài liệu, tên hiển thị, ảnh hồ sơ, tin nhắn và dữ liệu khác do người dùng đưa lên.</li>\n<li><strong>Tương tác</strong> bao gồm thích, phản ứng, bình luận, theo dõi, kết bạn, tìm kiếm, chọn kết quả, gửi tin nhắn và hành động khác được hỗ trợ.</li>\n<li><strong>Lạm dụng</strong> là việc sử dụng chức năng đúng kỹ thuật nhưng sai mục đích, gây hại cho người khác hoặc làm sai lệch hoạt động của hệ thống.</li>\n<li><strong>Vượt quyền</strong> là truy cập, sửa, xóa hoặc suy đoán dữ liệu ngoài quyền sở hữu hoặc đối tượng được phép.</li>\n<li><strong>Thực thi</strong> bao gồm từ chối yêu cầu, ẩn hoặc xóa nội dung, thu hồi phiên, hạn chế tài khoản, vô hiệu hóa tài khoản, chặn tệp hoặc chuyển vụ việc sang xem xét thủ công.</li>\n<li><strong>Bản triển khai công khai</strong> là môi trường được cung cấp cho người dùng ngoài nhóm dự án. Nguyên mẫu chạy local hoặc Docker nội bộ không tự động được coi là dịch vụ thương mại.</li>\n</ul>\n",
    "section": "cat-18"
  },
  {
    "id": "cat-19-content",
    "titleVi": "20. Điều kiện sử dụng tài khoản",
    "titleEn": "20. Điều kiện sử dụng tài khoản",
    "htmlVi": "<h3>20.1. Thông tin đăng ký</h3>\n<p>Người dùng phải sử dụng email thuộc quyền kiểm soát hợp pháp của mình và không cố tình cung cấp dữ liệu gây nhầm lẫn để chiếm quyền tài khoản khác. Báo cáo chưa quy định tên thật bắt buộc, vì vậy chính sách không tuyên bố người dùng phải dùng danh tính pháp lý, nhưng hành vi giả mạo nhằm lừa đảo hoặc gây hại vẫn bị cấm.</p>\n<h3>20.2. Mật khẩu và thiết bị</h3>\n<p>Người dùng chịu trách nhiệm hợp lý trong việc bảo vệ mật khẩu và thiết bị. Không được chia sẻ token, phiên hoặc bí mật xác thực. Người dùng nên thu hồi phiên không nhận ra và đăng xuất khỏi thiết bị dùng chung.</p>\n<h3>20.3. Tài khoản bị xâm nhập</h3>\n<p>Khi nghi ngờ bị xâm nhập, người dùng cần đổi mật khẩu, thu hồi phiên, kiểm tra hồ sơ và liên hệ kênh hỗ trợ. Đơn vị vận hành có thể tạm khóa phiên hoặc tài khoản để giảm thiệt hại. Quy trình phục hồi danh tính chi tiết phải được công bố riêng trước production.</p>\n<h3>20.4. Độ tuổi</h3>\n<p>Báo cáo chưa quy định độ tuổi tối thiểu. Bản triển khai công khai phải điền điều kiện độ tuổi và cơ chế xử lý tài khoản trẻ em theo pháp luật áp dụng. Không được giữ câu chữ chung chung nếu dịch vụ thực tế có người dùng vị thành niên.</p>\n",
    "htmlEn": "<h3>20.1. Thông tin đăng ký</h3>\n<p>Người dùng phải sử dụng email thuộc quyền kiểm soát hợp pháp của mình và không cố tình cung cấp dữ liệu gây nhầm lẫn để chiếm quyền tài khoản khác. Báo cáo chưa quy định tên thật bắt buộc, vì vậy chính sách không tuyên bố người dùng phải dùng danh tính pháp lý, nhưng hành vi giả mạo nhằm lừa đảo hoặc gây hại vẫn bị cấm.</p>\n<h3>20.2. Mật khẩu và thiết bị</h3>\n<p>Người dùng chịu trách nhiệm hợp lý trong việc bảo vệ mật khẩu và thiết bị. Không được chia sẻ token, phiên hoặc bí mật xác thực. Người dùng nên thu hồi phiên không nhận ra và đăng xuất khỏi thiết bị dùng chung.</p>\n<h3>20.3. Tài khoản bị xâm nhập</h3>\n<p>Khi nghi ngờ bị xâm nhập, người dùng cần đổi mật khẩu, thu hồi phiên, kiểm tra hồ sơ và liên hệ kênh hỗ trợ. Đơn vị vận hành có thể tạm khóa phiên hoặc tài khoản để giảm thiệt hại. Quy trình phục hồi danh tính chi tiết phải được công bố riêng trước production.</p>\n<h3>20.4. Độ tuổi</h3>\n<p>Báo cáo chưa quy định độ tuổi tối thiểu. Bản triển khai công khai phải điền điều kiện độ tuổi và cơ chế xử lý tài khoản trẻ em theo pháp luật áp dụng. Không được giữ câu chữ chung chung nếu dịch vụ thực tế có người dùng vị thành niên.</p>\n",
    "section": "cat-19"
  },
  {
    "id": "cat-20-content",
    "titleVi": "21. Tiêu chuẩn an toàn và tôn trọng",
    "titleEn": "21. Tiêu chuẩn an toàn và tôn trọng",
    "htmlVi": "<p>Các mục dưới đây là tiêu chuẩn vận hành cần có cho một mạng xã hội. Chúng không đồng nghĩa Fakebook hiện đã có hệ thống phát hiện tự động hoặc đội kiểm duyệt quy mô lớn.</p>\n<h3>21.1. Đe dọa và bạo lực</h3>\n<p>Không được đăng hoặc gửi:</p>\n<ul>\n<li>Lời đe dọa có chủ đích gây thương tích;</li>\n<li>Hướng dẫn hoặc kêu gọi tấn công một cá nhân cụ thể;</li>\n<li>Nội dung phối hợp hành vi bạo lực;</li>\n<li>Hình ảnh bạo lực nhằm quấy rối nạn nhân;</li>\n<li>Nội dung tôn vinh hành vi gây hại trong bối cảnh có nguy cơ thực tế.</li>\n</ul>\n<p>Nội dung giáo dục, tin tức hoặc thảo luận có thể cần ngữ cảnh. Bản triển khai công khai phải có quy trình xem xét, không chỉ dựa vào từ khóa.</p>\n<h3>21.2. Quấy rối và bắt nạt</h3>\n<p>Không được:</p>\n<ul>\n<li>Liên tục liên hệ sau khi người nhận đã từ chối;</li>\n<li>Dùng nhiều tài khoản để né chặn;</li>\n<li>Công khai làm nhục hoặc kích động đám đông tấn công một cá nhân;</li>\n<li>Gửi nội dung tình dục hoặc xúc phạm không mong muốn;</li>\n<li>Đe dọa tiết lộ thông tin riêng tư;</li>\n<li>Lợi dụng chức năng kết bạn, theo dõi, bình luận hoặc tin nhắn để gây áp lực.</li>\n</ul>\n<p>Chặn là tín hiệu rõ rằng người dùng không muốn tương tác. Né chặn được xem là vi phạm nghiêm trọng.</p>\n<h3>21.3. Thù ghét và hạ thấp phẩm giá</h3>\n<p>Không được tấn công người khác bằng lời kêu gọi loại trừ, bạo lực hoặc hạ thấp phẩm giá dựa trên đặc điểm được pháp luật bảo vệ. Chính sách công khai cần xác định rõ phạm vi đặc điểm và ngoại lệ cho thảo luận phản biện, giáo dục hoặc trích dẫn có ngữ cảnh.</p>\n<h3>21.4. Bóc lột và xâm hại trẻ em</h3>\n<p>Nghiêm cấm nội dung, yêu cầu, dụ dỗ, trao đổi hoặc liên kết liên quan đến bóc lột tình dục trẻ em. Khi phát hiện, đơn vị vận hành phải có quy trình bảo toàn bằng chứng tối thiểu, khóa truy cập và báo cơ quan phù hợp theo luật. Không cho phép người dùng tự chia sẻ lại nội dung như một cách “cảnh báo”.</p>\n<h3>21.5. Tự hại và nguy cơ khẩn cấp</h3>\n<p>Không được khuyến khích, cổ súy hoặc cung cấp nội dung có chủ đích thúc đẩy tự hại. Nội dung tìm kiếm hỗ trợ hoặc chia sẻ trải nghiệm phục hồi cần được xử lý thận trọng. Fakebook hiện chưa có hệ thống can thiệp khẩn cấp; vì vậy không nên tuyên bố có khả năng bảo đảm cứu hộ hoặc phản ứng 24/7 nếu chưa có.</p>\n<h3>21.6. Nội dung tình dục và riêng tư thân mật</h3>\n<p>Không được đăng hình ảnh thân mật của người khác khi chưa có sự đồng ý, nội dung cưỡng ép, bóc lột hoặc nội dung vi phạm pháp luật. Tệp riêng tư trong tin nhắn vẫn phải tuân theo chính sách; tính riêng tư của hội thoại không biến nội dung trái pháp luật thành được phép.</p>\n<h3>21.7. Thông tin cá nhân và doxxing</h3>\n<p>Không được công bố hoặc đe dọa công bố dữ liệu nhạy cảm của người khác để gây hại, bao gồm thông tin đăng nhập, token, địa chỉ riêng, tài liệu nhận dạng hoặc dữ liệu tài chính. Việc chia sẻ thông tin liên hệ công khai trong ngữ cảnh hợp pháp khác với doxxing có chủ đích.</p>\n",
    "htmlEn": "<p>Các mục dưới đây là tiêu chuẩn vận hành cần có cho một mạng xã hội. Chúng không đồng nghĩa Fakebook hiện đã có hệ thống phát hiện tự động hoặc đội kiểm duyệt quy mô lớn.</p>\n<h3>21.1. Đe dọa và bạo lực</h3>\n<p>Không được đăng hoặc gửi:</p>\n<ul>\n<li>Lời đe dọa có chủ đích gây thương tích;</li>\n<li>Hướng dẫn hoặc kêu gọi tấn công một cá nhân cụ thể;</li>\n<li>Nội dung phối hợp hành vi bạo lực;</li>\n<li>Hình ảnh bạo lực nhằm quấy rối nạn nhân;</li>\n<li>Nội dung tôn vinh hành vi gây hại trong bối cảnh có nguy cơ thực tế.</li>\n</ul>\n<p>Nội dung giáo dục, tin tức hoặc thảo luận có thể cần ngữ cảnh. Bản triển khai công khai phải có quy trình xem xét, không chỉ dựa vào từ khóa.</p>\n<h3>21.2. Quấy rối và bắt nạt</h3>\n<p>Không được:</p>\n<ul>\n<li>Liên tục liên hệ sau khi người nhận đã từ chối;</li>\n<li>Dùng nhiều tài khoản để né chặn;</li>\n<li>Công khai làm nhục hoặc kích động đám đông tấn công một cá nhân;</li>\n<li>Gửi nội dung tình dục hoặc xúc phạm không mong muốn;</li>\n<li>Đe dọa tiết lộ thông tin riêng tư;</li>\n<li>Lợi dụng chức năng kết bạn, theo dõi, bình luận hoặc tin nhắn để gây áp lực.</li>\n</ul>\n<p>Chặn là tín hiệu rõ rằng người dùng không muốn tương tác. Né chặn được xem là vi phạm nghiêm trọng.</p>\n<h3>21.3. Thù ghét và hạ thấp phẩm giá</h3>\n<p>Không được tấn công người khác bằng lời kêu gọi loại trừ, bạo lực hoặc hạ thấp phẩm giá dựa trên đặc điểm được pháp luật bảo vệ. Chính sách công khai cần xác định rõ phạm vi đặc điểm và ngoại lệ cho thảo luận phản biện, giáo dục hoặc trích dẫn có ngữ cảnh.</p>\n<h3>21.4. Bóc lột và xâm hại trẻ em</h3>\n<p>Nghiêm cấm nội dung, yêu cầu, dụ dỗ, trao đổi hoặc liên kết liên quan đến bóc lột tình dục trẻ em. Khi phát hiện, đơn vị vận hành phải có quy trình bảo toàn bằng chứng tối thiểu, khóa truy cập và báo cơ quan phù hợp theo luật. Không cho phép người dùng tự chia sẻ lại nội dung như một cách “cảnh báo”.</p>\n<h3>21.5. Tự hại và nguy cơ khẩn cấp</h3>\n<p>Không được khuyến khích, cổ súy hoặc cung cấp nội dung có chủ đích thúc đẩy tự hại. Nội dung tìm kiếm hỗ trợ hoặc chia sẻ trải nghiệm phục hồi cần được xử lý thận trọng. Fakebook hiện chưa có hệ thống can thiệp khẩn cấp; vì vậy không nên tuyên bố có khả năng bảo đảm cứu hộ hoặc phản ứng 24/7 nếu chưa có.</p>\n<h3>21.6. Nội dung tình dục và riêng tư thân mật</h3>\n<p>Không được đăng hình ảnh thân mật của người khác khi chưa có sự đồng ý, nội dung cưỡng ép, bóc lột hoặc nội dung vi phạm pháp luật. Tệp riêng tư trong tin nhắn vẫn phải tuân theo chính sách; tính riêng tư của hội thoại không biến nội dung trái pháp luật thành được phép.</p>\n<h3>21.7. Thông tin cá nhân và doxxing</h3>\n<p>Không được công bố hoặc đe dọa công bố dữ liệu nhạy cảm của người khác để gây hại, bao gồm thông tin đăng nhập, token, địa chỉ riêng, tài liệu nhận dạng hoặc dữ liệu tài chính. Việc chia sẻ thông tin liên hệ công khai trong ngữ cảnh hợp pháp khác với doxxing có chủ đích.</p>\n",
    "section": "cat-20"
  },
  {
    "id": "cat-21-content",
    "titleVi": "22. Tính toàn vẹn và hành vi xác thực",
    "titleEn": "22. Tính toàn vẹn và hành vi xác thực",
    "htmlVi": "<h3>22.1. Giả mạo</h3>\n<p>Không được giả mạo cá nhân, nhóm dự án, CMC University, giảng viên, đơn vị vận hành, nhân viên hỗ trợ hoặc nhà cung cấp thanh toán để lấy mật khẩu, tiền hoặc dữ liệu.</p>\n<p>Tài khoản parody hoặc fan page chỉ nên được phép khi không gây hiểu nhầm và khi tính năng loại tài khoản đó được hệ thống hỗ trợ. Báo cáo hiện chưa mô tả hệ thống xác minh danh tính hoặc huy hiệu xác minh.</p>\n<h3>22.2. Spam</h3>\n<p>Không được:</p>\n<ul>\n<li>Gửi yêu cầu kết bạn hoặc tin nhắn hàng loạt không mong muốn;</li>\n<li>Đăng cùng một nội dung lặp lại để chiếm bảng tin;</li>\n<li>Gắn liên kết lừa đảo;</li>\n<li>Tạo nhiều tài khoản để tăng tương tác;</li>\n<li>Dùng script để tự động bình luận, thích hoặc tìm kiếm với tần suất bất thường;</li>\n<li>Lợi dụng thông báo để làm phiền người khác.</li>\n</ul>\n<h3>22.3. Gian lận và lừa đảo</h3>\n<p>Không được dùng Fakebook để:</p>\n<ul>\n<li>Yêu cầu mật khẩu, token hoặc mã xác thực;</li>\n<li>Bán quyền truy cập giả;</li>\n<li>Tạo đơn Premium gian lận;</li>\n<li>Giả mạo trạng thái thanh toán từ browser return;</li>\n<li>Phát tán chương trình đầu tư, trúng thưởng hoặc hỗ trợ kỹ thuật giả;</li>\n<li>Mạo danh người khác để vay tiền hoặc lấy dữ liệu.</li>\n</ul>\n<h3>22.4. Thao túng xếp hạng</h3>\n<p>Không được cố tình làm sai lệch Search hoặc Recommendation bằng lượt xem giả, chọn kết quả lặp, tài khoản hàng loạt hoặc nội dung được tối ưu để qua mặt validation. Cơ chế ghi lựa chọn tối đa một lần mỗi kết quả mỗi ngày UTC giúp giảm một dạng thao túng nhưng không thay thế toàn bộ chống gian lận.</p>\n<h3>22.5. Phần mềm độc hại</h3>\n<p>Không được tải lên hoặc phát tán tệp chứa mã độc, macro nguy hiểm, payload khai thác, liên kết phishing hoặc nội dung nhằm chiếm quyền thiết bị. Kiểm tra MIME, phần mở rộng và magic byte không bảo đảm phát hiện mọi mã độc; bản production cần quét chuyên dụng nếu hỗ trợ loại tệp rủi ro.</p>\n",
    "htmlEn": "<h3>22.1. Giả mạo</h3>\n<p>Không được giả mạo cá nhân, nhóm dự án, CMC University, giảng viên, đơn vị vận hành, nhân viên hỗ trợ hoặc nhà cung cấp thanh toán để lấy mật khẩu, tiền hoặc dữ liệu.</p>\n<p>Tài khoản parody hoặc fan page chỉ nên được phép khi không gây hiểu nhầm và khi tính năng loại tài khoản đó được hệ thống hỗ trợ. Báo cáo hiện chưa mô tả hệ thống xác minh danh tính hoặc huy hiệu xác minh.</p>\n<h3>22.2. Spam</h3>\n<p>Không được:</p>\n<ul>\n<li>Gửi yêu cầu kết bạn hoặc tin nhắn hàng loạt không mong muốn;</li>\n<li>Đăng cùng một nội dung lặp lại để chiếm bảng tin;</li>\n<li>Gắn liên kết lừa đảo;</li>\n<li>Tạo nhiều tài khoản để tăng tương tác;</li>\n<li>Dùng script để tự động bình luận, thích hoặc tìm kiếm với tần suất bất thường;</li>\n<li>Lợi dụng thông báo để làm phiền người khác.</li>\n</ul>\n<h3>22.3. Gian lận và lừa đảo</h3>\n<p>Không được dùng Fakebook để:</p>\n<ul>\n<li>Yêu cầu mật khẩu, token hoặc mã xác thực;</li>\n<li>Bán quyền truy cập giả;</li>\n<li>Tạo đơn Premium gian lận;</li>\n<li>Giả mạo trạng thái thanh toán từ browser return;</li>\n<li>Phát tán chương trình đầu tư, trúng thưởng hoặc hỗ trợ kỹ thuật giả;</li>\n<li>Mạo danh người khác để vay tiền hoặc lấy dữ liệu.</li>\n</ul>\n<h3>22.4. Thao túng xếp hạng</h3>\n<p>Không được cố tình làm sai lệch Search hoặc Recommendation bằng lượt xem giả, chọn kết quả lặp, tài khoản hàng loạt hoặc nội dung được tối ưu để qua mặt validation. Cơ chế ghi lựa chọn tối đa một lần mỗi kết quả mỗi ngày UTC giúp giảm một dạng thao túng nhưng không thay thế toàn bộ chống gian lận.</p>\n<h3>22.5. Phần mềm độc hại</h3>\n<p>Không được tải lên hoặc phát tán tệp chứa mã độc, macro nguy hiểm, payload khai thác, liên kết phishing hoặc nội dung nhằm chiếm quyền thiết bị. Kiểm tra MIME, phần mở rộng và magic byte không bảo đảm phát hiện mọi mã độc; bản production cần quét chuyên dụng nếu hỗ trợ loại tệp rủi ro.</p>\n",
    "section": "cat-21"
  },
  {
    "id": "cat-22-content",
    "titleVi": "23. Quy tắc về nội dung và quyền của người khác",
    "titleEn": "23. Quy tắc về nội dung và quyền của người khác",
    "htmlVi": "<h3>23.1. Quyền sở hữu và quyền sử dụng</h3>\n<p>Người dùng chỉ nên đăng nội dung mình tạo, có quyền sử dụng hoặc được phép chia sẻ. Báo cáo không xác định giấy phép pháp lý mà người dùng cấp cho Fakebook để lưu trữ và phân phối nội dung. Trước khi phát hành công khai, Điều khoản sử dụng phải bổ sung phạm vi giấy phép, thời hạn, khả năng chấm dứt và cách xử lý nội dung đã chia sẻ.</p>\n<h3>23.2. Bản quyền và nhãn hiệu</h3>\n<p>Không được đăng lại tác phẩm có bản quyền hoặc dùng nhãn hiệu gây nhầm lẫn khi không có quyền. Fakebook hiện chưa mô tả quy trình notice-and-takedown hoàn chỉnh; bản triển khai thực tế phải thiết kế kênh báo cáo và phản hồi phù hợp pháp luật.</p>\n<h3>23.3. Nội dung sai ngữ cảnh</h3>\n<p>Người dùng không được chỉnh sửa, cắt ghép hoặc trình bày nội dung của người khác theo cách cố ý lừa đảo, bôi nhọ hoặc gây nguy hiểm. Không phải mọi thông tin sai đều có thể được kiểm duyệt tự động; cần ưu tiên những trường hợp có thiệt hại rõ ràng và khả năng xác minh.</p>\n<h3>23.4. Nội dung bị hạn chế bởi đối tượng xem</h3>\n<p>Không được sao chép hoặc phát tán nội dung riêng tư của người khác chỉ vì mình đang được phép xem. Cài đặt đối tượng xem là kiểm soát kỹ thuật, còn người xem vẫn có trách nhiệm tôn trọng ngữ cảnh và quyền của chủ nội dung.</p>\n",
    "htmlEn": "<h3>23.1. Quyền sở hữu và quyền sử dụng</h3>\n<p>Người dùng chỉ nên đăng nội dung mình tạo, có quyền sử dụng hoặc được phép chia sẻ. Báo cáo không xác định giấy phép pháp lý mà người dùng cấp cho Fakebook để lưu trữ và phân phối nội dung. Trước khi phát hành công khai, Điều khoản sử dụng phải bổ sung phạm vi giấy phép, thời hạn, khả năng chấm dứt và cách xử lý nội dung đã chia sẻ.</p>\n<h3>23.2. Bản quyền và nhãn hiệu</h3>\n<p>Không được đăng lại tác phẩm có bản quyền hoặc dùng nhãn hiệu gây nhầm lẫn khi không có quyền. Fakebook hiện chưa mô tả quy trình notice-and-takedown hoàn chỉnh; bản triển khai thực tế phải thiết kế kênh báo cáo và phản hồi phù hợp pháp luật.</p>\n<h3>23.3. Nội dung sai ngữ cảnh</h3>\n<p>Người dùng không được chỉnh sửa, cắt ghép hoặc trình bày nội dung của người khác theo cách cố ý lừa đảo, bôi nhọ hoặc gây nguy hiểm. Không phải mọi thông tin sai đều có thể được kiểm duyệt tự động; cần ưu tiên những trường hợp có thiệt hại rõ ràng và khả năng xác minh.</p>\n<h3>23.4. Nội dung bị hạn chế bởi đối tượng xem</h3>\n<p>Không được sao chép hoặc phát tán nội dung riêng tư của người khác chỉ vì mình đang được phép xem. Cài đặt đối tượng xem là kiểm soát kỹ thuật, còn người xem vẫn có trách nhiệm tôn trọng ngữ cảnh và quyền của chủ nội dung.</p>\n",
    "section": "cat-22"
  },
  {
    "id": "cat-23-content",
    "titleVi": "24. Quy tắc theo từng chức năng",
    "titleEn": "24. Quy tắc theo từng chức năng",
    "htmlVi": "<h3>24.1. Bài viết và bình luận</h3>\n<ul>\n<li>Không dùng bình luận để quấy rối hoặc spam.</li>\n<li>Không cố tình chèn payload, script hoặc chuỗi phá giao diện.</li>\n<li>Không đăng tệp không phù hợp với loại nội dung.</li>\n<li>Không lợi dụng chỉnh sửa hoặc xóa để che giấu hành vi gian lận khi có điều tra hợp lệ.</li>\n</ul>\n<h3>24.2. Bạn bè, theo dõi và chặn</h3>\n<ul>\n<li>Không gửi yêu cầu kết bạn hàng loạt.</li>\n<li>Không giả vờ có quan hệ với người khác.</li>\n<li>Không né chặn bằng tài khoản phụ.</li>\n<li>Không khai thác sự khác biệt giữa friendship và follow để truy cập nội dung hạn chế.</li>\n</ul>\n<h3>24.3. Tin nhắn</h3>\n<ul>\n<li>Chỉ người tham gia hợp lệ mới được truy cập hội thoại.</li>\n<li>Không thêm người vào nhóm nhằm quấy rối.</li>\n<li>Không gửi nội dung hàng loạt, phishing hoặc tệp nguy hiểm.</li>\n<li>Không cố đoán UUID hội thoại hay tin nhắn.</li>\n<li>Không tuyên bố hệ thống có mã hóa đầu cuối nếu chưa triển khai và kiểm chứng.</li>\n</ul>\n<h3>24.4. Tìm kiếm</h3>\n<ul>\n<li>Không dùng tìm kiếm để thu thập hàng loạt hồ sơ.</li>\n<li>Không scrape kết quả hoặc né phân trang và rate limit.</li>\n<li>Không tạo truy vấn có chủ đích dò dữ liệu riêng tư.</li>\n<li>Không thao túng lịch sử lựa chọn hoặc xếp hạng.</li>\n</ul>\n<h3>24.5. Đề xuất</h3>\n<ul>\n<li>Không tạo mạng lưới tương tác giả.</li>\n<li>Không dùng nội dung mồi để chuyển người dùng đến trang lừa đảo.</li>\n<li>Không giả định nội dung xuất hiện trong đề xuất đã được Fakebook xác nhận là đúng hoặc an toàn.</li>\n</ul>\n<h3>24.6. Media</h3>\n<ul>\n<li>Chỉ tải loại tệp được hỗ trợ.</li>\n<li>Không đổi phần mở rộng để che giấu loại tệp.</li>\n<li>Không tải tệp vượt giới hạn hoặc chia nhỏ để né kiểm tra.</li>\n<li>Không truy cập asset pending hoặc committed của người khác.</li>\n</ul>\n<h3>24.7. Premium và thanh toán</h3>\n<ul>\n<li>Không giả mạo webhook hoặc trạng thái thanh toán.</li>\n<li>Không gửi lặp đơn để tạo nhiều kích hoạt.</li>\n<li>Không khai thác chênh lệch giữa Payment, Authentication và Social Graph.</li>\n<li>Không tuyên bố quyền lợi thương mại ngoài phạm vi gói đã công bố.</li>\n<li>Mọi hoàn tiền, thuế, đối soát và xử lý tranh chấp phải có chính sách riêng trước khi thu tiền thật.</li>\n</ul>\n",
    "htmlEn": "<h3>24.1. Bài viết và bình luận</h3>\n<ul>\n<li>Không dùng bình luận để quấy rối hoặc spam.</li>\n<li>Không cố tình chèn payload, script hoặc chuỗi phá giao diện.</li>\n<li>Không đăng tệp không phù hợp với loại nội dung.</li>\n<li>Không lợi dụng chỉnh sửa hoặc xóa để che giấu hành vi gian lận khi có điều tra hợp lệ.</li>\n</ul>\n<h3>24.2. Bạn bè, theo dõi và chặn</h3>\n<ul>\n<li>Không gửi yêu cầu kết bạn hàng loạt.</li>\n<li>Không giả vờ có quan hệ với người khác.</li>\n<li>Không né chặn bằng tài khoản phụ.</li>\n<li>Không khai thác sự khác biệt giữa friendship và follow để truy cập nội dung hạn chế.</li>\n</ul>\n<h3>24.3. Tin nhắn</h3>\n<ul>\n<li>Chỉ người tham gia hợp lệ mới được truy cập hội thoại.</li>\n<li>Không thêm người vào nhóm nhằm quấy rối.</li>\n<li>Không gửi nội dung hàng loạt, phishing hoặc tệp nguy hiểm.</li>\n<li>Không cố đoán UUID hội thoại hay tin nhắn.</li>\n<li>Không tuyên bố hệ thống có mã hóa đầu cuối nếu chưa triển khai và kiểm chứng.</li>\n</ul>\n<h3>24.4. Tìm kiếm</h3>\n<ul>\n<li>Không dùng tìm kiếm để thu thập hàng loạt hồ sơ.</li>\n<li>Không scrape kết quả hoặc né phân trang và rate limit.</li>\n<li>Không tạo truy vấn có chủ đích dò dữ liệu riêng tư.</li>\n<li>Không thao túng lịch sử lựa chọn hoặc xếp hạng.</li>\n</ul>\n<h3>24.5. Đề xuất</h3>\n<ul>\n<li>Không tạo mạng lưới tương tác giả.</li>\n<li>Không dùng nội dung mồi để chuyển người dùng đến trang lừa đảo.</li>\n<li>Không giả định nội dung xuất hiện trong đề xuất đã được Fakebook xác nhận là đúng hoặc an toàn.</li>\n</ul>\n<h3>24.6. Media</h3>\n<ul>\n<li>Chỉ tải loại tệp được hỗ trợ.</li>\n<li>Không đổi phần mở rộng để che giấu loại tệp.</li>\n<li>Không tải tệp vượt giới hạn hoặc chia nhỏ để né kiểm tra.</li>\n<li>Không truy cập asset pending hoặc committed của người khác.</li>\n</ul>\n<h3>24.7. Premium và thanh toán</h3>\n<ul>\n<li>Không giả mạo webhook hoặc trạng thái thanh toán.</li>\n<li>Không gửi lặp đơn để tạo nhiều kích hoạt.</li>\n<li>Không khai thác chênh lệch giữa Payment, Authentication và Social Graph.</li>\n<li>Không tuyên bố quyền lợi thương mại ngoài phạm vi gói đã công bố.</li>\n<li>Mọi hoàn tiền, thuế, đối soát và xử lý tranh chấp phải có chính sách riêng trước khi thu tiền thật.</li>\n</ul>\n",
    "section": "cat-23"
  },
  {
    "id": "cat-24-content",
    "titleVi": "25. Chính sách dành cho API và tích hợp",
    "titleEn": "25. Chính sách dành cho API và tích hợp",
    "htmlVi": "<p>Fakebook chưa công bố API công cộng cho bên thứ ba. Bất kỳ truy cập trực tiếp nào vào endpoint nội bộ, header tin cậy hoặc cơ sở dữ liệu đều bị cấm khi chưa được nhóm cho phép.</p>\n<p>Các hành vi bị cấm gồm:</p>\n<ul>\n<li>Giả mạo HMAC, timestamp, nonce hoặc key identifier;</li>\n<li>Tái phát request đã ký;</li>\n<li>Gửi body khác với digest đã ký;</li>\n<li>Vượt qua Gateway để tự đặt identity header;</li>\n<li>Khai thác introspection hoặc truy vấn GraphQL quá sâu nhằm làm cạn tài nguyên;</li>\n<li>Dùng ID tăng dần hoặc Snowflake ID để dò tài nguyên;</li>\n<li>Truy cập file path hoặc URL media ngoài quyền;</li>\n<li>Thay đổi idempotency key để tạo hiệu ứng lặp có chủ đích.</li>\n</ul>\n<p>Bản production nên công bố riêng rate limit, quota, phạm vi sử dụng tự động và chương trình báo lỗi bảo mật.</p>\n",
    "htmlEn": "<p>Fakebook chưa công bố API công cộng cho bên thứ ba. Bất kỳ truy cập trực tiếp nào vào endpoint nội bộ, header tin cậy hoặc cơ sở dữ liệu đều bị cấm khi chưa được nhóm cho phép.</p>\n<p>Các hành vi bị cấm gồm:</p>\n<ul>\n<li>Giả mạo HMAC, timestamp, nonce hoặc key identifier;</li>\n<li>Tái phát request đã ký;</li>\n<li>Gửi body khác với digest đã ký;</li>\n<li>Vượt qua Gateway để tự đặt identity header;</li>\n<li>Khai thác introspection hoặc truy vấn GraphQL quá sâu nhằm làm cạn tài nguyên;</li>\n<li>Dùng ID tăng dần hoặc Snowflake ID để dò tài nguyên;</li>\n<li>Truy cập file path hoặc URL media ngoài quyền;</li>\n<li>Thay đổi idempotency key để tạo hiệu ứng lặp có chủ đích.</li>\n</ul>\n<p>Bản production nên công bố riêng rate limit, quota, phạm vi sử dụng tự động và chương trình báo lỗi bảo mật.</p>\n",
    "section": "cat-24"
  },
  {
    "id": "cat-25-content",
    "titleVi": "26. Báo cáo nội dung và hành vi vi phạm",
    "titleEn": "26. Báo cáo nội dung và hành vi vi phạm",
    "htmlVi": "<p>Báo cáo dự án chưa có hệ thống báo cáo nội dung quy mô hoàn chỉnh. Trước khi mở cho cộng đồng, quy trình tối thiểu nên gồm:</p>\n<ol>\n<li>Nút báo cáo trên hồ sơ, bài viết, bình luận và tin nhắn;</li>\n<li>Lựa chọn lý do rõ ràng;</li>\n<li>Khả năng đính kèm ngữ cảnh mà không yêu cầu gửi mật khẩu;</li>\n<li>Mã vụ việc;</li>\n<li>Ưu tiên trường hợp đe dọa, bóc lột trẻ em, lộ dữ liệu hoặc chiếm quyền tài khoản;</li>\n<li>Trạng thái xử lý;</li>\n<li>Bảo vệ người báo cáo khỏi bị lộ không cần thiết;</li>\n<li>Lưu bằng chứng ở mức cần thiết;</li>\n<li>Cơ chế chuyển cho cơ quan phù hợp khi bắt buộc;</li>\n<li>Thông báo kết quả ở mức không làm lộ dữ liệu của bên khác.</li>\n</ol>\n",
    "htmlEn": "<p>Báo cáo dự án chưa có hệ thống báo cáo nội dung quy mô hoàn chỉnh. Trước khi mở cho cộng đồng, quy trình tối thiểu nên gồm:</p>\n<ol>\n<li>Nút báo cáo trên hồ sơ, bài viết, bình luận và tin nhắn;</li>\n<li>Lựa chọn lý do rõ ràng;</li>\n<li>Khả năng đính kèm ngữ cảnh mà không yêu cầu gửi mật khẩu;</li>\n<li>Mã vụ việc;</li>\n<li>Ưu tiên trường hợp đe dọa, bóc lột trẻ em, lộ dữ liệu hoặc chiếm quyền tài khoản;</li>\n<li>Trạng thái xử lý;</li>\n<li>Bảo vệ người báo cáo khỏi bị lộ không cần thiết;</li>\n<li>Lưu bằng chứng ở mức cần thiết;</li>\n<li>Cơ chế chuyển cho cơ quan phù hợp khi bắt buộc;</li>\n<li>Thông báo kết quả ở mức không làm lộ dữ liệu của bên khác.</li>\n</ol>\n",
    "section": "cat-25"
  },
  {
    "id": "cat-26-content",
    "titleVi": "27. Nguyên tắc thực thi",
    "titleEn": "27. Nguyên tắc thực thi",
    "htmlVi": "<h3>27.1. Tính tương xứng</h3>\n<p>Biện pháp nên tương xứng với mức độ, ý định, hậu quả, lịch sử tái phạm và nguy cơ tiếp diễn. Một lỗi nhập liệu không nên bị xử lý như tấn công có chủ đích.</p>\n<h3>27.2. Thứ tự biện pháp có thể áp dụng</h3>\n<p>Tùy trường hợp, đơn vị vận hành có thể:</p>\n<ol>\n<li>Từ chối yêu cầu tại thời điểm gửi;</li>\n<li>Cảnh báo hoặc yêu cầu chỉnh sửa;</li>\n<li>Hạn chế tạm thời một chức năng;</li>\n<li>Ẩn hoặc xóa nội dung;</li>\n<li>Thu hồi một hoặc mọi phiên;</li>\n<li>Khóa tạm thời tài khoản;</li>\n<li>Vô hiệu hóa tài khoản;</li>\n<li>Chặn tệp hoặc địa chỉ kỹ thuật có nguy cơ;</li>\n<li>Lưu bằng chứng và chuyển vụ việc theo nghĩa vụ pháp lý.</li>\n</ol>\n<h3>27.3. Tự động và thủ công</h3>\n<p>Validation, phân quyền, rate limit, chặn, kiểm tra ownership và xác thực chữ ký có thể thực thi tự động. Các quyết định nội dung phức tạp cần xem xét thủ công. Fakebook hiện không nên tuyên bố có AI moderation toàn diện.</p>\n<h3>27.4. Tái phạm</h3>\n<p>Tái phạm, né hạn chế, tạo tài khoản mới hoặc phối hợp nhiều tài khoản có thể dẫn đến biện pháp nghiêm hơn. Cơ chế nhận diện phải tránh kết luận chỉ dựa trên một IP dùng chung.</p>\n",
    "htmlEn": "<h3>27.1. Tính tương xứng</h3>\n<p>Biện pháp nên tương xứng với mức độ, ý định, hậu quả, lịch sử tái phạm và nguy cơ tiếp diễn. Một lỗi nhập liệu không nên bị xử lý như tấn công có chủ đích.</p>\n<h3>27.2. Thứ tự biện pháp có thể áp dụng</h3>\n<p>Tùy trường hợp, đơn vị vận hành có thể:</p>\n<ol>\n<li>Từ chối yêu cầu tại thời điểm gửi;</li>\n<li>Cảnh báo hoặc yêu cầu chỉnh sửa;</li>\n<li>Hạn chế tạm thời một chức năng;</li>\n<li>Ẩn hoặc xóa nội dung;</li>\n<li>Thu hồi một hoặc mọi phiên;</li>\n<li>Khóa tạm thời tài khoản;</li>\n<li>Vô hiệu hóa tài khoản;</li>\n<li>Chặn tệp hoặc địa chỉ kỹ thuật có nguy cơ;</li>\n<li>Lưu bằng chứng và chuyển vụ việc theo nghĩa vụ pháp lý.</li>\n</ol>\n<h3>27.3. Tự động và thủ công</h3>\n<p>Validation, phân quyền, rate limit, chặn, kiểm tra ownership và xác thực chữ ký có thể thực thi tự động. Các quyết định nội dung phức tạp cần xem xét thủ công. Fakebook hiện không nên tuyên bố có AI moderation toàn diện.</p>\n<h3>27.4. Tái phạm</h3>\n<p>Tái phạm, né hạn chế, tạo tài khoản mới hoặc phối hợp nhiều tài khoản có thể dẫn đến biện pháp nghiêm hơn. Cơ chế nhận diện phải tránh kết luận chỉ dựa trên một IP dùng chung.</p>\n",
    "section": "cat-26"
  },
  {
    "id": "cat-27-content",
    "titleVi": "28. Kháng nghị và sửa sai",
    "titleEn": "28. Kháng nghị và sửa sai",
    "htmlVi": "<p>Bản triển khai công khai nên cho phép người dùng kháng nghị khi nội dung hoặc tài khoản bị xử lý. Quy trình nên gồm:</p>\n<ul>\n<li>Mã quyết định;</li>\n<li>Lý do đủ cụ thể;</li>\n<li>Thời hạn kháng nghị;</li>\n<li>Kênh gửi bằng chứng;</li>\n<li>Người xem xét khác nếu có thể;</li>\n<li>Kết quả giữ nguyên, sửa đổi hoặc đảo ngược;</li>\n<li>Khôi phục nội dung hoặc quyền khi xử lý sai;</li>\n<li>Hạn chế lạm dụng quy trình kháng nghị.</li>\n</ul>\n<p>Báo cáo hiện chưa xác nhận hệ thống này đã được triển khai, vì vậy trang sản phẩm không được hiển thị như một chức năng sẵn có nếu chưa có backend và vận hành tương ứng.</p>\n",
    "htmlEn": "<p>Bản triển khai công khai nên cho phép người dùng kháng nghị khi nội dung hoặc tài khoản bị xử lý. Quy trình nên gồm:</p>\n<ul>\n<li>Mã quyết định;</li>\n<li>Lý do đủ cụ thể;</li>\n<li>Thời hạn kháng nghị;</li>\n<li>Kênh gửi bằng chứng;</li>\n<li>Người xem xét khác nếu có thể;</li>\n<li>Kết quả giữ nguyên, sửa đổi hoặc đảo ngược;</li>\n<li>Khôi phục nội dung hoặc quyền khi xử lý sai;</li>\n<li>Hạn chế lạm dụng quy trình kháng nghị.</li>\n</ul>\n<p>Báo cáo hiện chưa xác nhận hệ thống này đã được triển khai, vì vậy trang sản phẩm không được hiển thị như một chức năng sẵn có nếu chưa có backend và vận hành tương ứng.</p>\n",
    "section": "cat-27"
  },
  {
    "id": "cat-28-content",
    "titleVi": "29. Tình huống minh họa",
    "titleEn": "29. Tình huống minh họa",
    "htmlVi": "<table>\n<thead>\n<tr>\n<th>Tình huống</th>\n<th>Đánh giá theo chính sách</th>\n<th>Biện pháp phù hợp có thể áp dụng</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>Người dùng đăng ảnh cá nhân với “Chỉ bạn bè”</td>\n<td>Được phép nếu có quyền với ảnh</td>\n<td>Hệ thống chỉ hiển thị cho bạn bè hợp lệ</td>\n</tr>\n<tr>\n<td>Tài khoản khác đoán URL ảnh và mở trực tiếp</td>\n<td>Vượt quyền</td>\n<td>Từ chối, ghi log, xem xét hạn chế nếu cố ý</td>\n</tr>\n<tr>\n<td>Gửi cùng một tin nhắn cho hàng trăm người lạ</td>\n<td>Spam</td>\n<td>Rate limit, hạn chế nhắn tin, xem xét tài khoản</td>\n</tr>\n<tr>\n<td>Đổi phần mở rộng file thực thi thành ảnh</td>\n<td>Né kiểm tra media</td>\n<td>Từ chối upload, ghi nhận hành vi bất thường</td>\n</tr>\n<tr>\n<td>Tự sửa browser return thành “paid”</td>\n<td>Gian lận thanh toán</td>\n<td>Không kích hoạt; chỉ webhook xác minh được chấp nhận</td>\n</tr>\n<tr>\n<td>Tìm kiếm tên người dùng hợp lệ</td>\n<td>Được phép</td>\n<td>Trả kết quả đã lọc quyền</td>\n</tr>\n<tr>\n<td>Dùng script scrape toàn bộ kết quả</td>\n<td>Lạm dụng API</td>\n<td>Rate limit, chặn hoặc thu hồi quyền</td>\n</tr>\n<tr>\n<td>Tạo tài khoản mới để liên hệ người đã chặn</td>\n<td>Né chặn và quấy rối</td>\n<td>Hạn chế hoặc vô hiệu hóa tài khoản</td>\n</tr>\n<tr>\n<td>Báo lỗi bảo mật có trách nhiệm</td>\n<td>Được khuyến khích</td>\n<td>Chuyển kênh bảo mật, không trừng phạt khi tuân thủ phạm vi</td>\n</tr>\n</tbody></table>\n",
    "htmlEn": "<table>\n<thead>\n<tr>\n<th>Tình huống</th>\n<th>Đánh giá theo chính sách</th>\n<th>Biện pháp phù hợp có thể áp dụng</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>Người dùng đăng ảnh cá nhân với “Chỉ bạn bè”</td>\n<td>Được phép nếu có quyền với ảnh</td>\n<td>Hệ thống chỉ hiển thị cho bạn bè hợp lệ</td>\n</tr>\n<tr>\n<td>Tài khoản khác đoán URL ảnh và mở trực tiếp</td>\n<td>Vượt quyền</td>\n<td>Từ chối, ghi log, xem xét hạn chế nếu cố ý</td>\n</tr>\n<tr>\n<td>Gửi cùng một tin nhắn cho hàng trăm người lạ</td>\n<td>Spam</td>\n<td>Rate limit, hạn chế nhắn tin, xem xét tài khoản</td>\n</tr>\n<tr>\n<td>Đổi phần mở rộng file thực thi thành ảnh</td>\n<td>Né kiểm tra media</td>\n<td>Từ chối upload, ghi nhận hành vi bất thường</td>\n</tr>\n<tr>\n<td>Tự sửa browser return thành “paid”</td>\n<td>Gian lận thanh toán</td>\n<td>Không kích hoạt; chỉ webhook xác minh được chấp nhận</td>\n</tr>\n<tr>\n<td>Tìm kiếm tên người dùng hợp lệ</td>\n<td>Được phép</td>\n<td>Trả kết quả đã lọc quyền</td>\n</tr>\n<tr>\n<td>Dùng script scrape toàn bộ kết quả</td>\n<td>Lạm dụng API</td>\n<td>Rate limit, chặn hoặc thu hồi quyền</td>\n</tr>\n<tr>\n<td>Tạo tài khoản mới để liên hệ người đã chặn</td>\n<td>Né chặn và quấy rối</td>\n<td>Hạn chế hoặc vô hiệu hóa tài khoản</td>\n</tr>\n<tr>\n<td>Báo lỗi bảo mật có trách nhiệm</td>\n<td>Được khuyến khích</td>\n<td>Chuyển kênh bảo mật, không trừng phạt khi tuân thủ phạm vi</td>\n</tr>\n</tbody></table>\n",
    "section": "cat-28"
  },
  {
    "id": "cat-29-content",
    "titleVi": "30. Những gì Fakebook chưa cam kết",
    "titleEn": "30. Những gì Fakebook chưa cam kết",
    "htmlVi": "<p>Do là nguyên mẫu học thuật, Fakebook chưa cam kết:</p>\n<ul>\n<li>Hoạt động liên tục 24/7;</li>\n<li>Thời gian phản hồi hỗ trợ cố định;</li>\n<li>Kiểm duyệt nội dung tự động toàn diện;</li>\n<li>Khôi phục mọi dữ liệu đã mất;</li>\n<li>Mã hóa đầu cuối tin nhắn;</li>\n<li>Xử lý thanh toán thương mại hoàn chỉnh;</li>\n<li>Hoàn tiền tự động;</li>\n<li>Phát hiện mọi mã độc;</li>\n<li>Bảo đảm tìm kiếm và đề xuất không có sai lệch;</li>\n<li>Phục vụ hàng triệu người dùng;</li>\n<li>Tuân thủ một khu vực pháp lý cụ thể khi chưa xác định đơn vị vận hành.</li>\n</ul>\n",
    "htmlEn": "<p>Do là nguyên mẫu học thuật, Fakebook chưa cam kết:</p>\n<ul>\n<li>Hoạt động liên tục 24/7;</li>\n<li>Thời gian phản hồi hỗ trợ cố định;</li>\n<li>Kiểm duyệt nội dung tự động toàn diện;</li>\n<li>Khôi phục mọi dữ liệu đã mất;</li>\n<li>Mã hóa đầu cuối tin nhắn;</li>\n<li>Xử lý thanh toán thương mại hoàn chỉnh;</li>\n<li>Hoàn tiền tự động;</li>\n<li>Phát hiện mọi mã độc;</li>\n<li>Bảo đảm tìm kiếm và đề xuất không có sai lệch;</li>\n<li>Phục vụ hàng triệu người dùng;</li>\n<li>Tuân thủ một khu vực pháp lý cụ thể khi chưa xác định đơn vị vận hành.</li>\n</ul>\n",
    "section": "cat-29"
  },
  {
    "id": "cat-30-content",
    "titleVi": "31. Checklist vận hành trước khi công khai",
    "titleEn": "31. Checklist vận hành trước khi công khai",
    "htmlVi": "<ul>\n<li>Điền pháp nhân, địa chỉ và kênh liên hệ.</li>\n<li>Quy định độ tuổi.</li>\n<li>Hoàn thiện Điều khoản sử dụng và giấy phép nội dung.</li>\n<li>Có hệ thống báo cáo và kháng nghị.</li>\n<li>Có vai trò moderator/admin và audit log.</li>\n<li>Có quy tắc ưu tiên vụ việc khẩn cấp.</li>\n<li>Có chính sách bản quyền.</li>\n<li>Có quy trình xử lý tài khoản bị xâm nhập.</li>\n<li>Có retention và deletion policy.</li>\n<li>Có chính sách payment/refund nếu thu tiền thật.</li>\n<li>Có chương trình báo lỗi bảo mật.</li>\n<li>Kiểm thử negative authorization, IDOR, replay, tampering và rate limit.</li>\n<li>Đảm bảo nội dung bị xóa hoặc đổi quyền được đồng bộ khỏi Search, Recommendation, cache và media.</li>\n<li>Công bố giới hạn dịch vụ một cách dễ hiểu.</li>\n</ul>\n",
    "htmlEn": "<ul>\n<li>Điền pháp nhân, địa chỉ và kênh liên hệ.</li>\n<li>Quy định độ tuổi.</li>\n<li>Hoàn thiện Điều khoản sử dụng và giấy phép nội dung.</li>\n<li>Có hệ thống báo cáo và kháng nghị.</li>\n<li>Có vai trò moderator/admin và audit log.</li>\n<li>Có quy tắc ưu tiên vụ việc khẩn cấp.</li>\n<li>Có chính sách bản quyền.</li>\n<li>Có quy trình xử lý tài khoản bị xâm nhập.</li>\n<li>Có retention và deletion policy.</li>\n<li>Có chính sách payment/refund nếu thu tiền thật.</li>\n<li>Có chương trình báo lỗi bảo mật.</li>\n<li>Kiểm thử negative authorization, IDOR, replay, tampering và rate limit.</li>\n<li>Đảm bảo nội dung bị xóa hoặc đổi quyền được đồng bộ khỏi Search, Recommendation, cache và media.</li>\n<li>Công bố giới hạn dịch vụ một cách dễ hiểu.</li>\n</ul>\n",
    "section": "cat-30"
  }
].map(art => ({
  id: art.id,
  titleVi: art.titleVi,
  titleEn: art.titleEn,
  contentVi: <div className="markdown-content" dangerouslySetInnerHTML={{ __html: art.htmlVi }} />,
  contentEn: <div className="markdown-content" dangerouslySetInnerHTML={{ __html: art.htmlEn }} />,
  section: art.section
}));
