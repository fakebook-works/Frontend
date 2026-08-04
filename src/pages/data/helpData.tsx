import { FaBookOpen, FaUserCog, FaShieldAlt, FaDesktop, FaKey, FaUsers } from "react-icons/fa";

// Mock mapping icons to categories based on index
const icons = [<FaDesktop />, <FaKey />, <FaUserCog />, <FaBookOpen />, <FaBookOpen />, <FaShieldAlt />, <FaUsers />];

export const HELP_CATEGORIES = [
  {
    "id": "cat-0",
    "titleVi": "1. Bắt đầu nhanh",
    "titleEn": "1. Bắt đầu nhanh",
    "articles": [
      {
        "id": "art-0-1",
        "titleVi": "1.1. Fakebook là gì?",
        "titleEn": "1.1. Fakebook là gì?",
        "htmlVi": "<p>Fakebook là ứng dụng mạng xã hội dạng web cho phép bạn:</p>\n<ul>\n<li>Tạo tài khoản và đăng nhập;</li>\n<li>Quản lý hồ sơ;</li>\n<li>Kết bạn, theo dõi hoặc chặn người dùng;</li>\n<li>Đăng bài có văn bản và tệp phương tiện;</li>\n<li>Chọn ai được xem bài viết;</li>\n<li>Thích, phản ứng và bình luận;</li>\n<li>Tìm kiếm người dùng và nội dung được hỗ trợ;</li>\n<li>Nhắn tin riêng hoặc theo nhóm;</li>\n<li>Nhận thông báo thời gian thực;</li>\n<li>Xem bài viết được đề xuất;</li>\n<li>Sử dụng Premium và thanh toán khi tính năng được bật.</li>\n</ul>\n",
        "htmlEn": "<p>Fakebook là ứng dụng mạng xã hội dạng web cho phép bạn:</p>\n<ul>\n<li>Tạo tài khoản và đăng nhập;</li>\n<li>Quản lý hồ sơ;</li>\n<li>Kết bạn, theo dõi hoặc chặn người dùng;</li>\n<li>Đăng bài có văn bản và tệp phương tiện;</li>\n<li>Chọn ai được xem bài viết;</li>\n<li>Thích, phản ứng và bình luận;</li>\n<li>Tìm kiếm người dùng và nội dung được hỗ trợ;</li>\n<li>Nhắn tin riêng hoặc theo nhóm;</li>\n<li>Nhận thông báo thời gian thực;</li>\n<li>Xem bài viết được đề xuất;</li>\n<li>Sử dụng Premium và thanh toán khi tính năng được bật.</li>\n</ul>\n"
      },
      {
        "id": "art-0-2",
        "titleVi": "1.2. Những gì chưa có trong phiên bản hiện tại",
        "titleEn": "1.2. Những gì chưa có trong phiên bản hiện tại",
        "htmlVi": "<p>Fakebook chưa hỗ trợ đầy đủ:</p>\n<ul>\n<li>Livestream;</li>\n<li>Gọi thoại hoặc gọi video;</li>\n<li>Marketplace;</li>\n<li>Quảng cáo thương mại;</li>\n<li>Xác thực bằng khuôn mặt hoặc vân tay;</li>\n<li>Quản trị cộng đồng và kiểm duyệt quy mô lớn;</li>\n<li>Triển khai thương mại cho hàng triệu người dùng;</li>\n<li>Thanh toán, hoàn tiền và đối soát cấp sản phẩm thương mại.</li>\n</ul>\n",
        "htmlEn": "<p>Fakebook chưa hỗ trợ đầy đủ:</p>\n<ul>\n<li>Livestream;</li>\n<li>Gọi thoại hoặc gọi video;</li>\n<li>Marketplace;</li>\n<li>Quảng cáo thương mại;</li>\n<li>Xác thực bằng khuôn mặt hoặc vân tay;</li>\n<li>Quản trị cộng đồng và kiểm duyệt quy mô lớn;</li>\n<li>Triển khai thương mại cho hàng triệu người dùng;</li>\n<li>Thanh toán, hoàn tiền và đối soát cấp sản phẩm thương mại.</li>\n</ul>\n"
      }
    ]
  },
  {
    "id": "cat-1",
    "titleVi": "2. Tạo tài khoản và đăng nhập",
    "titleEn": "2. Tạo tài khoản và đăng nhập",
    "articles": [
      {
        "id": "art-1-1",
        "titleVi": "2.1. Đăng ký tài khoản",
        "titleEn": "2.1. Đăng ký tài khoản",
        "htmlVi": "<ol>\n<li>Mở trang đăng ký.</li>\n<li>Nhập email hợp lệ.</li>\n<li>Tạo mật khẩu theo yêu cầu hiển thị.</li>\n<li>Gửi biểu mẫu.</li>\n<li>Nếu thành công, tiếp tục đăng nhập hoặc làm theo bước xác minh được giao diện yêu cầu.</li>\n</ol>\n<p>Hệ thống có thể từ chối khi:</p>\n<ul>\n<li>Email sai định dạng;</li>\n<li>Email đã được sử dụng;</li>\n<li>Mật khẩu không đạt yêu cầu;</li>\n<li>Dữ liệu bắt buộc bị thiếu;</li>\n<li>Máy khách gửi yêu cầu quá nhiều lần.</li>\n</ul>\n",
        "htmlEn": "<ol>\n<li>Mở trang đăng ký.</li>\n<li>Nhập email hợp lệ.</li>\n<li>Tạo mật khẩu theo yêu cầu hiển thị.</li>\n<li>Gửi biểu mẫu.</li>\n<li>Nếu thành công, tiếp tục đăng nhập hoặc làm theo bước xác minh được giao diện yêu cầu.</li>\n</ol>\n<p>Hệ thống có thể từ chối khi:</p>\n<ul>\n<li>Email sai định dạng;</li>\n<li>Email đã được sử dụng;</li>\n<li>Mật khẩu không đạt yêu cầu;</li>\n<li>Dữ liệu bắt buộc bị thiếu;</li>\n<li>Máy khách gửi yêu cầu quá nhiều lần.</li>\n</ul>\n"
      },
      {
        "id": "art-1-2",
        "titleVi": "2.2. Đăng nhập",
        "titleEn": "2.2. Đăng nhập",
        "htmlVi": "<ol>\n<li>Nhập email và mật khẩu.</li>\n<li>Chọn <strong>Đăng nhập</strong>.</li>\n<li>Sau khi xác thực thành công, Fakebook tạo một phiên đăng nhập và cấp token truy cập.</li>\n</ol>\n<p>Nếu đăng nhập thất bại:</p>\n<ul>\n<li>Kiểm tra email có bị gõ sai không;</li>\n<li>Kiểm tra Caps Lock;</li>\n<li>Thử tải lại trang;</li>\n<li>Bảo đảm thời gian trên thiết bị không sai quá nhiều;</li>\n<li>Chờ một lúc nếu bạn đã thử quá nhiều lần;</li>\n<li>Dùng chức năng đặt lại mật khẩu nếu giao diện cung cấp.</li>\n</ul>\n",
        "htmlEn": "<ol>\n<li>Nhập email và mật khẩu.</li>\n<li>Chọn <strong>Đăng nhập</strong>.</li>\n<li>Sau khi xác thực thành công, Fakebook tạo một phiên đăng nhập và cấp token truy cập.</li>\n</ol>\n<p>Nếu đăng nhập thất bại:</p>\n<ul>\n<li>Kiểm tra email có bị gõ sai không;</li>\n<li>Kiểm tra Caps Lock;</li>\n<li>Thử tải lại trang;</li>\n<li>Bảo đảm thời gian trên thiết bị không sai quá nhiều;</li>\n<li>Chờ một lúc nếu bạn đã thử quá nhiều lần;</li>\n<li>Dùng chức năng đặt lại mật khẩu nếu giao diện cung cấp.</li>\n</ul>\n"
      },
      {
        "id": "art-1-3",
        "titleVi": "2.3. Đăng xuất",
        "titleEn": "2.3. Đăng xuất",
        "htmlVi": "<p>Chọn <strong>Đăng xuất</strong> trong menu tài khoản. Phiên hiện tại sẽ bị thu hồi và không còn dùng để truy cập tài nguyên được bảo vệ.</p>\n",
        "htmlEn": "<p>Chọn <strong>Đăng xuất</strong> trong menu tài khoản. Phiên hiện tại sẽ bị thu hồi và không còn dùng để truy cập tài nguyên được bảo vệ.</p>\n"
      },
      {
        "id": "art-1-4",
        "titleVi": "2.4. Quản lý nhiều phiên",
        "titleEn": "2.4. Quản lý nhiều phiên",
        "htmlVi": "<p>Fakebook có thể cho phép bạn đăng nhập trên nhiều thiết bị. Khi trang quản lý phiên được bật, bạn có thể:</p>\n<ul>\n<li>Xem phiên hiện tại và phiên khác;</li>\n<li>Xem thông tin thiết bị, IP và thời điểm;</li>\n<li>Thu hồi một phiên;</li>\n<li>Thu hồi toàn bộ phiên.</li>\n</ul>\n<p>Hãy thu hồi ngay phiên mà bạn không nhận ra.</p>\n",
        "htmlEn": "<p>Fakebook có thể cho phép bạn đăng nhập trên nhiều thiết bị. Khi trang quản lý phiên được bật, bạn có thể:</p>\n<ul>\n<li>Xem phiên hiện tại và phiên khác;</li>\n<li>Xem thông tin thiết bị, IP và thời điểm;</li>\n<li>Thu hồi một phiên;</li>\n<li>Thu hồi toàn bộ phiên.</li>\n</ul>\n<p>Hãy thu hồi ngay phiên mà bạn không nhận ra.</p>\n"
      }
    ]
  },
  {
    "id": "cat-2",
    "titleVi": "3. Hồ sơ cá nhân",
    "titleEn": "3. Hồ sơ cá nhân",
    "articles": [
      {
        "id": "art-2-1",
        "titleVi": "3.1. Cập nhật hồ sơ",
        "titleEn": "3.1. Cập nhật hồ sơ",
        "htmlVi": "<p>Bạn có thể cập nhật các trường hồ sơ cơ bản được giao diện hỗ trợ, như tên hiển thị, thông tin giới thiệu và ảnh hồ sơ.</p>\n",
        "htmlEn": "<p>Bạn có thể cập nhật các trường hồ sơ cơ bản được giao diện hỗ trợ, như tên hiển thị, thông tin giới thiệu và ảnh hồ sơ.</p>\n"
      },
      {
        "id": "art-2-2",
        "titleVi": "3.2. Thay ảnh đại diện hoặc ảnh hồ sơ",
        "titleEn": "3.2. Thay ảnh đại diện hoặc ảnh hồ sơ",
        "htmlVi": "<ol>\n<li>Chọn vùng ảnh hồ sơ.</li>\n<li>Chọn tệp được hỗ trợ.</li>\n<li>Chờ quá trình tải lên và kiểm tra tệp.</li>\n<li>Xác nhận lưu thay đổi.</li>\n</ol>\n<p>Tệp có thể bị từ chối nếu:</p>\n<ul>\n<li>Vượt giới hạn kích thước;</li>\n<li>Phần mở rộng không khớp loại nội dung;</li>\n<li>Chữ ký nhị phân không hợp lệ;</li>\n<li>Chứa dữ liệu thực thi hoặc nội dung nguy hiểm;</li>\n<li>Kết nối bị ngắt trước khi tải xong.</li>\n</ul>\n",
        "htmlEn": "<ol>\n<li>Chọn vùng ảnh hồ sơ.</li>\n<li>Chọn tệp được hỗ trợ.</li>\n<li>Chờ quá trình tải lên và kiểm tra tệp.</li>\n<li>Xác nhận lưu thay đổi.</li>\n</ol>\n<p>Tệp có thể bị từ chối nếu:</p>\n<ul>\n<li>Vượt giới hạn kích thước;</li>\n<li>Phần mở rộng không khớp loại nội dung;</li>\n<li>Chữ ký nhị phân không hợp lệ;</li>\n<li>Chứa dữ liệu thực thi hoặc nội dung nguy hiểm;</li>\n<li>Kết nối bị ngắt trước khi tải xong.</li>\n</ul>\n"
      }
    ]
  },
  {
    "id": "cat-3",
    "titleVi": "4. Bảng tin",
    "titleEn": "4. Bảng tin",
    "articles": [
      {
        "id": "art-3-1",
        "titleVi": "4.1. Nội dung nào xuất hiện trên bảng tin?",
        "titleEn": "4.1. Nội dung nào xuất hiện trên bảng tin?",
        "htmlVi": "<p>Bảng tin hiển thị nội dung mà bạn hiện có quyền xem. Nội dung có thể đến từ bạn bè, người theo dõi hoặc nguồn được hệ thống đề xuất.</p>\n<p>Phiên bản hiện tại không triển khai quảng cáo thương mại trong bảng tin.</p>\n",
        "htmlEn": "<p>Bảng tin hiển thị nội dung mà bạn hiện có quyền xem. Nội dung có thể đến từ bạn bè, người theo dõi hoặc nguồn được hệ thống đề xuất.</p>\n<p>Phiên bản hiện tại không triển khai quảng cáo thương mại trong bảng tin.</p>\n"
      },
      {
        "id": "art-3-2",
        "titleVi": "4.2. Vì sao tôi không thấy một bài viết?",
        "titleEn": "4.2. Vì sao tôi không thấy một bài viết?",
        "htmlVi": "<p>Có thể do:</p>\n<ul>\n<li>Tác giả chọn đối tượng xem không bao gồm bạn;</li>\n<li>Quan hệ bạn bè hoặc theo dõi đã thay đổi;</li>\n<li>Bạn hoặc tác giả đã chặn nhau;</li>\n<li>Bài viết đã bị xóa hoặc không còn truy cập được;</li>\n<li>Chỉ mục tìm kiếm hoặc dữ liệu đề xuất chưa đồng bộ;</li>\n<li>Dịch vụ Social Graph tạm thời không phản hồi.</li>\n</ul>\n",
        "htmlEn": "<p>Có thể do:</p>\n<ul>\n<li>Tác giả chọn đối tượng xem không bao gồm bạn;</li>\n<li>Quan hệ bạn bè hoặc theo dõi đã thay đổi;</li>\n<li>Bạn hoặc tác giả đã chặn nhau;</li>\n<li>Bài viết đã bị xóa hoặc không còn truy cập được;</li>\n<li>Chỉ mục tìm kiếm hoặc dữ liệu đề xuất chưa đồng bộ;</li>\n<li>Dịch vụ Social Graph tạm thời không phản hồi.</li>\n</ul>\n"
      },
      {
        "id": "art-3-3",
        "titleVi": "4.3. Bảng tin tải chậm",
        "titleEn": "4.3. Bảng tin tải chậm",
        "htmlVi": "<p>Hãy thử:</p>\n<ul>\n<li>Kiểm tra kết nối mạng;</li>\n<li>Tải lại trang;</li>\n<li>Đóng các tab tiêu tốn nhiều bộ nhớ;</li>\n<li>Thử lại sau nếu dịch vụ đang khởi động;</li>\n<li>Kiểm tra xem Docker hoặc các dịch vụ backend đã chạy đủ nếu bạn đang dùng môi trường phát triển.</li>\n</ul>\n<p>Mục tiêu dự án là hiển thị nội dung đầu tiên trong khoảng hai giây ở môi trường kiểm thử đã định nghĩa, nhưng đây không phải cam kết SLA cho mọi thiết bị và mạng.</p>\n",
        "htmlEn": "<p>Hãy thử:</p>\n<ul>\n<li>Kiểm tra kết nối mạng;</li>\n<li>Tải lại trang;</li>\n<li>Đóng các tab tiêu tốn nhiều bộ nhớ;</li>\n<li>Thử lại sau nếu dịch vụ đang khởi động;</li>\n<li>Kiểm tra xem Docker hoặc các dịch vụ backend đã chạy đủ nếu bạn đang dùng môi trường phát triển.</li>\n</ul>\n<p>Mục tiêu dự án là hiển thị nội dung đầu tiên trong khoảng hai giây ở môi trường kiểm thử đã định nghĩa, nhưng đây không phải cam kết SLA cho mọi thiết bị và mạng.</p>\n"
      }
    ]
  },
  {
    "id": "cat-4",
    "titleVi": "5. Tạo bài viết",
    "titleEn": "5. Tạo bài viết",
    "articles": [
      {
        "id": "art-4-1",
        "titleVi": "5.1. Đăng bài có văn bản",
        "titleEn": "5.1. Đăng bài có văn bản",
        "htmlVi": "<ol>\n<li>Chọn <strong>Tạo bài viết</strong>.</li>\n<li>Nhập nội dung.</li>\n<li>Chọn đối tượng xem.</li>\n<li>Kiểm tra lại nhãn quyền riêng tư.</li>\n<li>Chọn <strong>Đăng</strong>.</li>\n</ol>\n",
        "htmlEn": "<ol>\n<li>Chọn <strong>Tạo bài viết</strong>.</li>\n<li>Nhập nội dung.</li>\n<li>Chọn đối tượng xem.</li>\n<li>Kiểm tra lại nhãn quyền riêng tư.</li>\n<li>Chọn <strong>Đăng</strong>.</li>\n</ol>\n"
      },
      {
        "id": "art-4-2",
        "titleVi": "5.2. Đăng bài có tệp phương tiện",
        "titleEn": "5.2. Đăng bài có tệp phương tiện",
        "htmlVi": "<ol>\n<li>Chọn tệp từ thiết bị.</li>\n<li>Chờ tệp tải lên.</li>\n<li>Xem trước tệp.</li>\n<li>Chọn đối tượng xem.</li>\n<li>Đăng bài.</li>\n</ol>\n<p>Fakebook sử dụng luồng tải lên theo giai đoạn. Tệp có thể được tải lên trước dưới trạng thái tạm, sau đó mới được gắn chính thức với bài viết. Nếu bạn hủy, tệp tạm có thể được dọn dẹp tự động.</p>\n",
        "htmlEn": "<ol>\n<li>Chọn tệp từ thiết bị.</li>\n<li>Chờ tệp tải lên.</li>\n<li>Xem trước tệp.</li>\n<li>Chọn đối tượng xem.</li>\n<li>Đăng bài.</li>\n</ol>\n<p>Fakebook sử dụng luồng tải lên theo giai đoạn. Tệp có thể được tải lên trước dưới trạng thái tạm, sau đó mới được gắn chính thức với bài viết. Nếu bạn hủy, tệp tạm có thể được dọn dẹp tự động.</p>\n"
      },
      {
        "id": "art-4-3",
        "titleVi": "5.3. Lỗi thường gặp khi đăng bài",
        "titleEn": "5.3. Lỗi thường gặp khi đăng bài",
        "htmlVi": "<ul>\n<li><strong>Dữ liệu không hợp lệ:</strong> kiểm tra nội dung, trường bắt buộc và loại tệp.</li>\n<li><strong>Chưa đăng nhập:</strong> đăng nhập lại.</li>\n<li><strong>Không có quyền:</strong> kiểm tra chủ sở hữu hoặc đối tượng thao tác.</li>\n<li><strong>Tệp không được hỗ trợ:</strong> chọn tệp khác.</li>\n<li><strong>Xung đột:</strong> thao tác có thể đã được thực hiện hoặc dữ liệu đã thay đổi.</li>\n<li><strong>Lỗi máy chủ:</strong> thử lại sau và ghi lại mã tương quan nếu giao diện hiển thị.</li>\n</ul>\n",
        "htmlEn": "<ul>\n<li><strong>Dữ liệu không hợp lệ:</strong> kiểm tra nội dung, trường bắt buộc và loại tệp.</li>\n<li><strong>Chưa đăng nhập:</strong> đăng nhập lại.</li>\n<li><strong>Không có quyền:</strong> kiểm tra chủ sở hữu hoặc đối tượng thao tác.</li>\n<li><strong>Tệp không được hỗ trợ:</strong> chọn tệp khác.</li>\n<li><strong>Xung đột:</strong> thao tác có thể đã được thực hiện hoặc dữ liệu đã thay đổi.</li>\n<li><strong>Lỗi máy chủ:</strong> thử lại sau và ghi lại mã tương quan nếu giao diện hiển thị.</li>\n</ul>\n"
      }
    ]
  },
  {
    "id": "cat-5",
    "titleVi": "6. Chọn quyền riêng tư cho bài viết",
    "titleEn": "6. Chọn quyền riêng tư cho bài viết",
    "articles": [
      {
        "id": "art-5-1",
        "titleVi": "6.1. Các lựa chọn hiện có",
        "titleEn": "6.1. Các lựa chọn hiện có",
        "htmlVi": "<ul>\n<li><strong>Công khai:</strong> dành cho phạm vi công khai được hỗ trợ.</li>\n<li><strong>Bạn bè và người theo dõi:</strong> dành cho các quan hệ tương ứng.</li>\n<li><strong>Chỉ bạn bè:</strong> chỉ các tài khoản có quan hệ bạn bè hợp lệ.</li>\n<li><strong>Chỉ mình tôi:</strong> chỉ bạn có thể xem.</li>\n</ul>\n",
        "htmlEn": "<ul>\n<li><strong>Công khai:</strong> dành cho phạm vi công khai được hỗ trợ.</li>\n<li><strong>Bạn bè và người theo dõi:</strong> dành cho các quan hệ tương ứng.</li>\n<li><strong>Chỉ bạn bè:</strong> chỉ các tài khoản có quan hệ bạn bè hợp lệ.</li>\n<li><strong>Chỉ mình tôi:</strong> chỉ bạn có thể xem.</li>\n</ul>\n"
      },
      {
        "id": "art-5-2",
        "titleVi": "6.2. Cách kiểm tra trước khi đăng",
        "titleEn": "6.2. Cách kiểm tra trước khi đăng",
        "htmlVi": "<p>Nhãn đối tượng xem phải hiển thị rõ ngay trong trình tạo bài viết. Không nên đăng nếu nhãn chưa đúng với mong muốn của bạn.</p>\n",
        "htmlEn": "<p>Nhãn đối tượng xem phải hiển thị rõ ngay trong trình tạo bài viết. Không nên đăng nếu nhãn chưa đúng với mong muốn của bạn.</p>\n"
      },
      {
        "id": "art-5-3",
        "titleVi": "6.3. Vì sao người khác vẫn không xem được bài viết công khai?",
        "titleEn": "6.3. Vì sao người khác vẫn không xem được bài viết công khai?",
        "htmlVi": "<p>Một bài viết có thể vẫn bị hạn chế bởi:</p>\n<ul>\n<li>Trạng thái chặn;</li>\n<li>Tài khoản hoặc nội dung không còn hoạt động;</li>\n<li>Quyền truy cập theo ngữ cảnh;</li>\n<li>Lỗi đồng bộ tạm thời;</li>\n<li>Giới hạn của phiên bản nguyên mẫu.</li>\n</ul>\n",
        "htmlEn": "<p>Một bài viết có thể vẫn bị hạn chế bởi:</p>\n<ul>\n<li>Trạng thái chặn;</li>\n<li>Tài khoản hoặc nội dung không còn hoạt động;</li>\n<li>Quyền truy cập theo ngữ cảnh;</li>\n<li>Lỗi đồng bộ tạm thời;</li>\n<li>Giới hạn của phiên bản nguyên mẫu.</li>\n</ul>\n"
      },
      {
        "id": "art-5-4",
        "titleVi": "6.4. Fakebook có “Bạn bè ngoại trừ…” không?",
        "titleEn": "6.4. Fakebook có “Bạn bè ngoại trừ…” không?",
        "htmlVi": "<p>Chưa. Báo cáo xác định đây là hướng phát triển trong tương lai cùng với danh sách bạn bè tùy chỉnh và quyền riêng tư chi tiết hơn.</p>\n",
        "htmlEn": "<p>Chưa. Báo cáo xác định đây là hướng phát triển trong tương lai cùng với danh sách bạn bè tùy chỉnh và quyền riêng tư chi tiết hơn.</p>\n"
      }
    ]
  },
  {
    "id": "cat-6",
    "titleVi": "7. Thích, phản ứng và bình luận",
    "titleEn": "7. Thích, phản ứng và bình luận",
    "articles": [
      {
        "id": "art-6-1",
        "titleVi": "7.1. Thích hoặc phản ứng",
        "titleEn": "7.1. Thích hoặc phản ứng",
        "htmlVi": "<p>Chọn nút tương tác trên bài viết. Sau khi API xử lý thành công, giao diện sẽ cập nhật mà không cần tải lại toàn bộ trang.</p>\n",
        "htmlEn": "<p>Chọn nút tương tác trên bài viết. Sau khi API xử lý thành công, giao diện sẽ cập nhật mà không cần tải lại toàn bộ trang.</p>\n"
      },
      {
        "id": "art-6-2",
        "titleVi": "7.2. Bình luận",
        "titleEn": "7.2. Bình luận",
        "htmlVi": "<ol>\n<li>Mở vùng bình luận.</li>\n<li>Nhập nội dung.</li>\n<li>Gửi bình luận.</li>\n</ol>\n<p>Bạn chỉ có thể tương tác với bài viết mà mình có quyền xem và khi không bị chặn bởi quy tắc quan hệ.</p>\n",
        "htmlEn": "<ol>\n<li>Mở vùng bình luận.</li>\n<li>Nhập nội dung.</li>\n<li>Gửi bình luận.</li>\n</ol>\n<p>Bạn chỉ có thể tương tác với bài viết mà mình có quyền xem và khi không bị chặn bởi quy tắc quan hệ.</p>\n"
      },
      {
        "id": "art-6-3",
        "titleVi": "7.3. Thao tác bị lặp",
        "titleEn": "7.3. Thao tác bị lặp",
        "htmlVi": "<p>Một số API dùng khóa idempotency để tránh tạo nhiều bản ghi khi yêu cầu được gửi lại do mạng yếu. Nếu bạn bấm nhiều lần nhưng chỉ thấy một kết quả, đây có thể là hành vi bảo vệ bình thường.</p>\n",
        "htmlEn": "<p>Một số API dùng khóa idempotency để tránh tạo nhiều bản ghi khi yêu cầu được gửi lại do mạng yếu. Nếu bạn bấm nhiều lần nhưng chỉ thấy một kết quả, đây có thể là hành vi bảo vệ bình thường.</p>\n"
      }
    ]
  },
  {
    "id": "cat-7",
    "titleVi": "8. Bạn bè, theo dõi và chặn",
    "titleEn": "8. Bạn bè, theo dõi và chặn",
    "articles": [
      {
        "id": "art-7-1",
        "titleVi": "8.1. Gửi yêu cầu kết bạn",
        "titleEn": "8.1. Gửi yêu cầu kết bạn",
        "htmlVi": "<ol>\n<li>Mở hồ sơ người dùng.</li>\n<li>Chọn <strong>Thêm bạn</strong>.</li>\n<li>Chờ người đó chấp nhận hoặc từ chối.</li>\n</ol>\n<p>Hệ thống ngăn yêu cầu trùng lặp.</p>\n",
        "htmlEn": "<ol>\n<li>Mở hồ sơ người dùng.</li>\n<li>Chọn <strong>Thêm bạn</strong>.</li>\n<li>Chờ người đó chấp nhận hoặc từ chối.</li>\n</ol>\n<p>Hệ thống ngăn yêu cầu trùng lặp.</p>\n"
      },
      {
        "id": "art-7-2",
        "titleVi": "8.2. Chấp nhận hoặc từ chối",
        "titleEn": "8.2. Chấp nhận hoặc từ chối",
        "htmlVi": "<p>Mở khu vực yêu cầu kết bạn hoặc thông báo, sau đó chọn hành động phù hợp.</p>\n",
        "htmlEn": "<p>Mở khu vực yêu cầu kết bạn hoặc thông báo, sau đó chọn hành động phù hợp.</p>\n"
      },
      {
        "id": "art-7-3",
        "titleVi": "8.3. Hủy kết bạn",
        "titleEn": "8.3. Hủy kết bạn",
        "htmlVi": "<p>Mở hồ sơ hoặc danh sách bạn bè, chọn tùy chọn quản lý quan hệ rồi xác nhận.</p>\n",
        "htmlEn": "<p>Mở hồ sơ hoặc danh sách bạn bè, chọn tùy chọn quản lý quan hệ rồi xác nhận.</p>\n"
      },
      {
        "id": "art-7-4",
        "titleVi": "8.4. Chặn người dùng",
        "titleEn": "8.4. Chặn người dùng",
        "htmlVi": "<p>Khi chặn một tài khoản, các tương tác bị chính sách chặn giới hạn sẽ bị từ chối. Việc chặn có thể ảnh hưởng đến quyền xem nội dung, gửi yêu cầu, nhắn tin hoặc tương tác.</p>\n",
        "htmlEn": "<p>Khi chặn một tài khoản, các tương tác bị chính sách chặn giới hạn sẽ bị từ chối. Việc chặn có thể ảnh hưởng đến quyền xem nội dung, gửi yêu cầu, nhắn tin hoặc tương tác.</p>\n"
      },
      {
        "id": "art-7-5",
        "titleVi": "8.5. Tôi có thể né chặn bằng tài khoản khác không?",
        "titleEn": "8.5. Tôi có thể né chặn bằng tài khoản khác không?",
        "htmlVi": "<p>Không. Dùng tài khoản khác để quấy rối hoặc vượt qua quyết định chặn là hành vi vi phạm chính sách sử dụng.</p>\n",
        "htmlEn": "<p>Không. Dùng tài khoản khác để quấy rối hoặc vượt qua quyết định chặn là hành vi vi phạm chính sách sử dụng.</p>\n"
      }
    ]
  },
  {
    "id": "cat-8",
    "titleVi": "9. Tìm kiếm",
    "titleEn": "9. Tìm kiếm",
    "articles": [
      {
        "id": "art-8-1",
        "titleVi": "9.1. Tôi có thể tìm gì?",
        "titleEn": "9.1. Tôi có thể tìm gì?",
        "htmlVi": "<p>Tùy dữ liệu đang có, Fakebook có thể tìm:</p>\n<ul>\n<li>Người dùng;</li>\n<li>Nhóm;</li>\n<li>Bài viết trên bảng tin;</li>\n<li>Bài viết nhóm;</li>\n<li>Reels hoặc loại nội dung được hỗ trợ.</li>\n</ul>\n",
        "htmlEn": "<p>Tùy dữ liệu đang có, Fakebook có thể tìm:</p>\n<ul>\n<li>Người dùng;</li>\n<li>Nhóm;</li>\n<li>Bài viết trên bảng tin;</li>\n<li>Bài viết nhóm;</li>\n<li>Reels hoặc loại nội dung được hỗ trợ.</li>\n</ul>\n"
      },
      {
        "id": "art-8-2",
        "titleVi": "9.2. Gợi ý tìm kiếm",
        "titleEn": "9.2. Gợi ý tìm kiếm",
        "htmlVi": "<p>Gợi ý có thể xuất hiện khi bạn nhập từ khóa. Mục tiêu kiểm thử của dự án là trả gợi ý trong khoảng một giây trong môi trường đã xác định.</p>\n",
        "htmlEn": "<p>Gợi ý có thể xuất hiện khi bạn nhập từ khóa. Mục tiêu kiểm thử của dự án là trả gợi ý trong khoảng một giây trong môi trường đã xác định.</p>\n"
      },
      {
        "id": "art-8-3",
        "titleVi": "9.3. Vì sao không có kết quả?",
        "titleEn": "9.3. Vì sao không có kết quả?",
        "htmlVi": "<ul>\n<li>Từ khóa không khớp;</li>\n<li>Nội dung chưa được lập chỉ mục;</li>\n<li>Nội dung đã bị xóa;</li>\n<li>Bạn không có quyền xem;</li>\n<li>Người dùng đã chặn bạn hoặc bạn đã chặn họ;</li>\n<li>Dịch vụ tìm kiếm đang đồng bộ hoặc tạm thời không hoạt động.</li>\n</ul>\n",
        "htmlEn": "<ul>\n<li>Từ khóa không khớp;</li>\n<li>Nội dung chưa được lập chỉ mục;</li>\n<li>Nội dung đã bị xóa;</li>\n<li>Bạn không có quyền xem;</li>\n<li>Người dùng đã chặn bạn hoặc bạn đã chặn họ;</li>\n<li>Dịch vụ tìm kiếm đang đồng bộ hoặc tạm thời không hoạt động.</li>\n</ul>\n"
      },
      {
        "id": "art-8-4",
        "titleVi": "9.4. Fakebook có lưu lịch sử tìm kiếm không?",
        "titleEn": "9.4. Fakebook có lưu lịch sử tìm kiếm không?",
        "htmlVi": "<p>Hệ thống có thể ghi nhận lựa chọn kết quả để hỗ trợ xếp hạng. Thiết kế dự án giới hạn một lượt ghi nhận cho cùng kết quả trong một ngày UTC.</p>\n",
        "htmlEn": "<p>Hệ thống có thể ghi nhận lựa chọn kết quả để hỗ trợ xếp hạng. Thiết kế dự án giới hạn một lượt ghi nhận cho cùng kết quả trong một ngày UTC.</p>\n"
      }
    ]
  },
  {
    "id": "cat-9",
    "titleVi": "10. Nhắn tin",
    "titleEn": "10. Nhắn tin",
    "articles": [
      {
        "id": "art-9-1",
        "titleVi": "10.1. Bắt đầu hội thoại",
        "titleEn": "10.1. Bắt đầu hội thoại",
        "htmlVi": "<ol>\n<li>Mở hồ sơ hoặc Messenger.</li>\n<li>Chọn người dùng hoặc hội thoại.</li>\n<li>Nhập tin nhắn.</li>\n<li>Gửi.</li>\n</ol>\n<p>Bạn chỉ có thể truy cập hội thoại khi là người tham gia hợp lệ.</p>\n",
        "htmlEn": "<ol>\n<li>Mở hồ sơ hoặc Messenger.</li>\n<li>Chọn người dùng hoặc hội thoại.</li>\n<li>Nhập tin nhắn.</li>\n<li>Gửi.</li>\n</ol>\n<p>Bạn chỉ có thể truy cập hội thoại khi là người tham gia hợp lệ.</p>\n"
      },
      {
        "id": "art-9-2",
        "titleVi": "10.2. Tin nhắn đang gửi nhưng chưa xuất hiện ở người nhận",
        "titleEn": "10.2. Tin nhắn đang gửi nhưng chưa xuất hiện ở người nhận",
        "htmlVi": "<p>Có thể do:</p>\n<ul>\n<li>Kết nối SSE bị gián đoạn;</li>\n<li>Người nhận mất mạng;</li>\n<li>Dịch vụ nhắn tin đang thử gửi lại sự kiện;</li>\n<li>Quyền giao tiếp vừa thay đổi;</li>\n<li>Tệp đính kèm chưa hoàn tất.</li>\n</ul>\n<p>Hãy chờ vài giây hoặc mở lại hội thoại. Dữ liệu chuẩn được lấy lại từ máy chủ khi kết nối phục hồi.</p>\n",
        "htmlEn": "<p>Có thể do:</p>\n<ul>\n<li>Kết nối SSE bị gián đoạn;</li>\n<li>Người nhận mất mạng;</li>\n<li>Dịch vụ nhắn tin đang thử gửi lại sự kiện;</li>\n<li>Quyền giao tiếp vừa thay đổi;</li>\n<li>Tệp đính kèm chưa hoàn tất.</li>\n</ul>\n<p>Hãy chờ vài giây hoặc mở lại hội thoại. Dữ liệu chuẩn được lấy lại từ máy chủ khi kết nối phục hồi.</p>\n"
      },
      {
        "id": "art-9-3",
        "titleVi": "10.3. Tin nhắn bị gửi hai lần",
        "titleEn": "10.3. Tin nhắn bị gửi hai lần",
        "htmlVi": "<p>Ứng dụng dùng mã tin nhắn phía máy khách để tránh tạo bản sao khi yêu cầu được gửi lại. Nếu vẫn thấy trùng, hãy ghi lại thời gian, hội thoại và mã lỗi để báo nhóm phát triển.</p>\n",
        "htmlEn": "<p>Ứng dụng dùng mã tin nhắn phía máy khách để tránh tạo bản sao khi yêu cầu được gửi lại. Nếu vẫn thấy trùng, hãy ghi lại thời gian, hội thoại và mã lỗi để báo nhóm phát triển.</p>\n"
      },
      {
        "id": "art-9-4",
        "titleVi": "10.4. Người ngoài có thể đọc hội thoại không?",
        "titleEn": "10.4. Người ngoài có thể đọc hội thoại không?",
        "htmlVi": "<p>Theo thiết kế, không. Dịch vụ kiểm tra tư cách người tham gia tại thời điểm đọc và ghi. Việc biết mã hội thoại không đủ để truy cập.</p>\n",
        "htmlEn": "<p>Theo thiết kế, không. Dịch vụ kiểm tra tư cách người tham gia tại thời điểm đọc và ghi. Việc biết mã hội thoại không đủ để truy cập.</p>\n"
      }
    ]
  },
  {
    "id": "cat-10",
    "titleVi": "11. Thông báo",
    "titleEn": "11. Thông báo",
    "articles": [
      {
        "id": "art-10-1",
        "titleVi": "11.1. Các loại thông báo",
        "titleEn": "11.1. Các loại thông báo",
        "htmlVi": "<p>Tùy chức năng đang chạy, bạn có thể nhận thông báo về:</p>\n<ul>\n<li>Yêu cầu kết bạn;</li>\n<li>Tin nhắn;</li>\n<li>Tương tác xã hội;</li>\n<li>Sự kiện được các dịch vụ khác tạo.</li>\n</ul>\n",
        "htmlEn": "<p>Tùy chức năng đang chạy, bạn có thể nhận thông báo về:</p>\n<ul>\n<li>Yêu cầu kết bạn;</li>\n<li>Tin nhắn;</li>\n<li>Tương tác xã hội;</li>\n<li>Sự kiện được các dịch vụ khác tạo.</li>\n</ul>\n"
      },
      {
        "id": "art-10-2",
        "titleVi": "11.2. Đánh dấu đã đọc",
        "titleEn": "11.2. Đánh dấu đã đọc",
        "htmlVi": "<p>Mở thông báo hoặc dùng hành động <strong>Đánh dấu đã đọc</strong>. Chỉ chủ sở hữu thông báo mới có thể sửa trạng thái của nó.</p>\n",
        "htmlEn": "<p>Mở thông báo hoặc dùng hành động <strong>Đánh dấu đã đọc</strong>. Chỉ chủ sở hữu thông báo mới có thể sửa trạng thái của nó.</p>\n"
      },
      {
        "id": "art-10-3",
        "titleVi": "11.3. Không nhận được thông báo thời gian thực",
        "titleEn": "11.3. Không nhận được thông báo thời gian thực",
        "htmlVi": "<ul>\n<li>Kiểm tra kết nối mạng;</li>\n<li>Tải lại trang để thiết lập lại subscription;</li>\n<li>Xác nhận phiên đăng nhập còn hoạt động;</li>\n<li>Kiểm tra dịch vụ Notification và API Gateway;</li>\n<li>Kiểm tra cấu hình SSE/nginx nếu đang phát triển cục bộ.</li>\n</ul>\n<p>Thông báo vẫn có thể đã được lưu trong cơ sở dữ liệu dù sự kiện thời gian thực chưa đến trình duyệt.</p>\n",
        "htmlEn": "<ul>\n<li>Kiểm tra kết nối mạng;</li>\n<li>Tải lại trang để thiết lập lại subscription;</li>\n<li>Xác nhận phiên đăng nhập còn hoạt động;</li>\n<li>Kiểm tra dịch vụ Notification và API Gateway;</li>\n<li>Kiểm tra cấu hình SSE/nginx nếu đang phát triển cục bộ.</li>\n</ul>\n<p>Thông báo vẫn có thể đã được lưu trong cơ sở dữ liệu dù sự kiện thời gian thực chưa đến trình duyệt.</p>\n"
      }
    ]
  },
  {
    "id": "cat-11",
    "titleVi": "12. Nội dung đề xuất",
    "titleEn": "12. Nội dung đề xuất",
    "articles": [
      {
        "id": "art-11-1",
        "titleVi": "12.1. Đề xuất hoạt động như thế nào?",
        "titleEn": "12.1. Đề xuất hoạt động như thế nào?",
        "htmlVi": "<p>Hệ thống có thể dùng vector người dùng, vector bài viết và các tín hiệu như thích, lưu, xem, chia sẻ hoặc bình luận để xếp hạng ứng viên.</p>\n",
        "htmlEn": "<p>Hệ thống có thể dùng vector người dùng, vector bài viết và các tín hiệu như thích, lưu, xem, chia sẻ hoặc bình luận để xếp hạng ứng viên.</p>\n"
      },
      {
        "id": "art-11-2",
        "titleVi": "12.2. Fakebook có đề xuất bài viết riêng tư không?",
        "titleEn": "12.2. Fakebook có đề xuất bài viết riêng tư không?",
        "htmlVi": "<p>Không nên. Ứng viên phải được Social Graph lọc theo quyền riêng tư và quan hệ trước khi xếp hạng và trả về.</p>\n",
        "htmlEn": "<p>Không nên. Ứng viên phải được Social Graph lọc theo quyền riêng tư và quan hệ trước khi xếp hạng và trả về.</p>\n"
      },
      {
        "id": "art-11-3",
        "titleVi": "12.3. Vì sao đề xuất chưa chính xác?",
        "titleEn": "12.3. Vì sao đề xuất chưa chính xác?",
        "htmlVi": "<p>Hệ thống là nguyên mẫu và có ít dữ liệu tương tác. Người dùng mới và bài viết mới có thể gặp vấn đề “cold start”. Chất lượng chưa được đánh giá bằng dữ liệu dài hạn hoặc thí nghiệm quy mô lớn.</p>\n",
        "htmlEn": "<p>Hệ thống là nguyên mẫu và có ít dữ liệu tương tác. Người dùng mới và bài viết mới có thể gặp vấn đề “cold start”. Chất lượng chưa được đánh giá bằng dữ liệu dài hạn hoặc thí nghiệm quy mô lớn.</p>\n"
      }
    ]
  },
  {
    "id": "cat-12",
    "titleVi": "13. Tệp phương tiện",
    "titleEn": "13. Tệp phương tiện",
    "articles": [
      {
        "id": "art-12-1",
        "titleVi": "13.1. Vì sao tải tệp thất bại?",
        "titleEn": "13.1. Vì sao tải tệp thất bại?",
        "htmlVi": "<p>Kiểm tra:</p>\n<ul>\n<li>Bạn đã đăng nhập chưa;</li>\n<li>Phiên còn hoạt động không;</li>\n<li>Kích thước tệp;</li>\n<li>Loại MIME và phần mở rộng;</li>\n<li>Tệp có bị hỏng không;</li>\n<li>Kết nối mạng;</li>\n<li>Quyền sở hữu thao tác;</li>\n<li>Cấu hình thư mục lưu trữ của Upload Service.</li>\n</ul>\n",
        "htmlEn": "<p>Kiểm tra:</p>\n<ul>\n<li>Bạn đã đăng nhập chưa;</li>\n<li>Phiên còn hoạt động không;</li>\n<li>Kích thước tệp;</li>\n<li>Loại MIME và phần mở rộng;</li>\n<li>Tệp có bị hỏng không;</li>\n<li>Kết nối mạng;</li>\n<li>Quyền sở hữu thao tác;</li>\n<li>Cấu hình thư mục lưu trữ của Upload Service.</li>\n</ul>\n"
      },
      {
        "id": "art-12-2",
        "titleVi": "13.2. Tệp đã tải lên nhưng bài viết không được tạo",
        "titleEn": "13.2. Tệp đã tải lên nhưng bài viết không được tạo",
        "htmlVi": "<p>Tệp có thể vẫn ở trạng thái tạm. Hệ thống có thể hủy hoặc dọn dẹp tệp chưa được gắn với nội dung. Hãy thử lại quá trình tạo bài viết thay vì dùng lại URL tạm không còn hiệu lực.</p>\n",
        "htmlEn": "<p>Tệp có thể vẫn ở trạng thái tạm. Hệ thống có thể hủy hoặc dọn dẹp tệp chưa được gắn với nội dung. Hãy thử lại quá trình tạo bài viết thay vì dùng lại URL tạm không còn hiệu lực.</p>\n"
      },
      {
        "id": "art-12-3",
        "titleVi": "13.3. Fakebook có CDN hoặc tối ưu ảnh tự động không?",
        "titleEn": "13.3. Fakebook có CDN hoặc tối ưu ảnh tự động không?",
        "htmlVi": "<p>Chưa trong phạm vi hiện tại. Báo cáo đề xuất CDN, object storage, resize, thumbnail và chuyển đổi định dạng cho tương lai.</p>\n",
        "htmlEn": "<p>Chưa trong phạm vi hiện tại. Báo cáo đề xuất CDN, object storage, resize, thumbnail và chuyển đổi định dạng cho tương lai.</p>\n"
      }
    ]
  },
  {
    "id": "cat-13",
    "titleVi": "14. Premium và thanh toán",
    "titleEn": "14. Premium và thanh toán",
    "articles": [
      {
        "id": "art-13-1",
        "titleVi": "14.1. Vì sao tôi không thấy Premium?",
        "titleEn": "14.1. Vì sao tôi không thấy Premium?",
        "htmlVi": "<p>Chức năng thanh toán có thể bị tắt mặc định trong môi trường dự án.</p>\n",
        "htmlEn": "<p>Chức năng thanh toán có thể bị tắt mặc định trong môi trường dự án.</p>\n"
      },
      {
        "id": "art-13-2",
        "titleVi": "14.2. Các gói được mô tả",
        "titleEn": "14.2. Các gói được mô tả",
        "htmlVi": "<p>Báo cáo thiết kế đề cập hai gói:</p>\n<ul>\n<li>Gói tháng;</li>\n<li>Gói năm.</li>\n</ul>\n<p>Giá và khả năng thanh toán chỉ nên hiển thị khi dịch vụ được cấu hình và kiểm thử đúng môi trường.</p>\n",
        "htmlEn": "<p>Báo cáo thiết kế đề cập hai gói:</p>\n<ul>\n<li>Gói tháng;</li>\n<li>Gói năm.</li>\n</ul>\n<p>Giá và khả năng thanh toán chỉ nên hiển thị khi dịch vụ được cấu hình và kiểm thử đúng môi trường.</p>\n"
      },
      {
        "id": "art-13-3",
        "titleVi": "14.3. Tôi đã quay lại từ trang thanh toán nhưng chưa có Premium",
        "titleEn": "14.3. Tôi đã quay lại từ trang thanh toán nhưng chưa có Premium",
        "htmlVi": "<p>Trang quay lại trong trình duyệt không tự xác nhận thanh toán. Hệ thống chỉ kích hoạt sau khi nhận webhook hợp lệ từ nhà cung cấp và hoàn tất đồng bộ với các dịch vụ liên quan.</p>\n",
        "htmlEn": "<p>Trang quay lại trong trình duyệt không tự xác nhận thanh toán. Hệ thống chỉ kích hoạt sau khi nhận webhook hợp lệ từ nhà cung cấp và hoàn tất đồng bộ với các dịch vụ liên quan.</p>\n"
      },
      {
        "id": "art-13-4",
        "titleVi": "14.4. Có hoàn tiền không?",
        "titleEn": "14.4. Có hoàn tiền không?",
        "htmlVi": "<p>Phiên bản hiện tại chưa có quy trình hoàn tiền hoặc đối soát thương mại hoàn chỉnh.</p>\n",
        "htmlEn": "<p>Phiên bản hiện tại chưa có quy trình hoàn tiền hoặc đối soát thương mại hoàn chỉnh.</p>\n"
      }
    ]
  },
  {
    "id": "cat-14",
    "titleVi": "15. Mã lỗi thường gặp",
    "titleEn": "15. Mã lỗi thường gặp",
    "articles": [
      {
        "id": "art-14-1",
        "titleVi": "`INVALID_INPUT`",
        "titleEn": "`INVALID_INPUT`",
        "htmlVi": "<p>Dữ liệu gửi lên sai định dạng, thiếu trường hoặc vượt giới hạn.</p>\n",
        "htmlEn": "<p>Dữ liệu gửi lên sai định dạng, thiếu trường hoặc vượt giới hạn.</p>\n"
      },
      {
        "id": "art-14-2",
        "titleVi": "`UNAUTHENTICATED`",
        "titleEn": "`UNAUTHENTICATED`",
        "htmlVi": "<p>Bạn chưa đăng nhập, token hết hạn, token không hợp lệ hoặc phiên đã bị thu hồi.</p>\n",
        "htmlEn": "<p>Bạn chưa đăng nhập, token hết hạn, token không hợp lệ hoặc phiên đã bị thu hồi.</p>\n"
      },
      {
        "id": "art-14-3",
        "titleVi": "`FORBIDDEN`",
        "titleEn": "`FORBIDDEN`",
        "htmlVi": "<p>Bạn đã đăng nhập nhưng không có quyền truy cập tài nguyên hoặc thực hiện hành động.</p>\n",
        "htmlEn": "<p>Bạn đã đăng nhập nhưng không có quyền truy cập tài nguyên hoặc thực hiện hành động.</p>\n"
      },
      {
        "id": "art-14-4",
        "titleVi": "`NOT_FOUND`",
        "titleEn": "`NOT_FOUND`",
        "htmlVi": "<p>Đối tượng không tồn tại, đã bị xóa hoặc không thể được trả về trong ngữ cảnh hiện tại.</p>\n",
        "htmlEn": "<p>Đối tượng không tồn tại, đã bị xóa hoặc không thể được trả về trong ngữ cảnh hiện tại.</p>\n"
      },
      {
        "id": "art-14-5",
        "titleVi": "`CONFLICT`",
        "titleEn": "`CONFLICT`",
        "htmlVi": "<p>Dữ liệu đã tồn tại, trạng thái đã thay đổi hoặc yêu cầu bị trùng.</p>\n",
        "htmlEn": "<p>Dữ liệu đã tồn tại, trạng thái đã thay đổi hoặc yêu cầu bị trùng.</p>\n"
      },
      {
        "id": "art-14-6",
        "titleVi": "`INTERNAL_ERROR`",
        "titleEn": "`INTERNAL_ERROR`",
        "htmlVi": "<p>Lỗi ngoài dự kiến ở máy chủ. Hãy thử lại và cung cấp mã tương quan nếu có.</p>\n",
        "htmlEn": "<p>Lỗi ngoài dự kiến ở máy chủ. Hãy thử lại và cung cấp mã tương quan nếu có.</p>\n"
      }
    ]
  },
  {
    "id": "cat-15",
    "titleVi": "16. Bảo vệ tài khoản",
    "titleEn": "16. Bảo vệ tài khoản",
    "articles": []
  },
  {
    "id": "cat-16",
    "titleVi": "17. Câu hỏi thường gặp",
    "titleEn": "17. Câu hỏi thường gặp",
    "articles": [
      {
        "id": "art-16-1",
        "titleVi": "Fakebook có phải Facebook không?",
        "titleEn": "Fakebook có phải Facebook không?",
        "htmlVi": "<p>Không. Fakebook là dự án mạng xã hội học thuật độc lập, được xây dựng để học và minh họa kỹ thuật phần mềm phân tán.</p>\n",
        "htmlEn": "<p>Không. Fakebook là dự án mạng xã hội học thuật độc lập, được xây dựng để học và minh họa kỹ thuật phần mềm phân tán.</p>\n"
      },
      {
        "id": "art-16-2",
        "titleVi": "Fakebook có quảng cáo không?",
        "titleEn": "Fakebook có quảng cáo không?",
        "htmlVi": "<p>Hệ thống quảng cáo thương mại nằm ngoài phạm vi hiện tại.</p>\n",
        "htmlEn": "<p>Hệ thống quảng cáo thương mại nằm ngoài phạm vi hiện tại.</p>\n"
      },
      {
        "id": "art-16-3",
        "titleVi": "Tôi có thể xóa tài khoản không?",
        "titleEn": "Tôi có thể xóa tài khoản không?",
        "htmlVi": "<p>Báo cáo chưa xác nhận quy trình xóa tài khoản tự phục vụ. Trước khi triển khai công khai, nhóm cần bổ sung chức năng và chính sách xóa dữ liệu.</p>\n",
        "htmlEn": "<p>Báo cáo chưa xác nhận quy trình xóa tài khoản tự phục vụ. Trước khi triển khai công khai, nhóm cần bổ sung chức năng và chính sách xóa dữ liệu.</p>\n"
      },
      {
        "id": "art-16-4",
        "titleVi": "Tôi có thể tải xuống toàn bộ dữ liệu không?",
        "titleEn": "Tôi có thể tải xuống toàn bộ dữ liệu không?",
        "htmlVi": "<p>Chưa được mô tả trong phạm vi hiện tại.</p>\n",
        "htmlEn": "<p>Chưa được mô tả trong phạm vi hiện tại.</p>\n"
      },
      {
        "id": "art-16-5",
        "titleVi": "Fakebook có đọc tin nhắn để đề xuất nội dung không?",
        "titleEn": "Fakebook có đọc tin nhắn để đề xuất nội dung không?",
        "htmlVi": "<p>Báo cáo không mô tả việc dùng nội dung tin nhắn riêng để tạo đề xuất. Hệ thống đề xuất được mô tả dựa trên dữ liệu người dùng, bài viết và tín hiệu tương tác.</p>\n",
        "htmlEn": "<p>Báo cáo không mô tả việc dùng nội dung tin nhắn riêng để tạo đề xuất. Hệ thống đề xuất được mô tả dựa trên dữ liệu người dùng, bài viết và tín hiệu tương tác.</p>\n"
      },
      {
        "id": "art-16-6",
        "titleVi": "Tại sao bài viết của tôi không xuất hiện trong tìm kiếm?",
        "titleEn": "Tại sao bài viết của tôi không xuất hiện trong tìm kiếm?",
        "htmlVi": "<p>Có thể do chỉ mục chưa cập nhật, quyền riêng tư hạn chế, loại đối tượng chưa được hỗ trợ hoặc nội dung đã bị xóa.</p>\n",
        "htmlEn": "<p>Có thể do chỉ mục chưa cập nhật, quyền riêng tư hạn chế, loại đối tượng chưa được hỗ trợ hoặc nội dung đã bị xóa.</p>\n"
      },
      {
        "id": "art-16-7",
        "titleVi": "Tại sao tôi vẫn thấy trạng thái cũ sau khi thao tác?",
        "titleEn": "Tại sao tôi vẫn thấy trạng thái cũ sau khi thao tác?",
        "htmlVi": "<p>Một số cập nhật đi qua nhiều dịch vụ và có thể đồng bộ theo cơ chế eventual consistency. Tải lại phần liên quan hoặc chờ quá trình nền hoàn tất.</p>\n",
        "htmlEn": "<p>Một số cập nhật đi qua nhiều dịch vụ và có thể đồng bộ theo cơ chế eventual consistency. Tải lại phần liên quan hoặc chờ quá trình nền hoàn tất.</p>\n"
      },
      {
        "id": "art-16-8",
        "titleVi": "Fakebook có hoạt động trên điện thoại không?",
        "titleEn": "Fakebook có hoạt động trên điện thoại không?",
        "htmlVi": "<p>Giao diện được thiết kế đáp ứng cho kích thước desktop và mobile được hỗ trợ.</p>\n",
        "htmlEn": "<p>Giao diện được thiết kế đáp ứng cho kích thước desktop và mobile được hỗ trợ.</p>\n"
      }
    ]
  },
  {
    "id": "cat-17",
    "titleVi": "18. Cách gửi báo cáo lỗi hiệu quả",
    "titleEn": "18. Cách gửi báo cáo lỗi hiệu quả",
    "articles": []
  },
  {
    "id": "cat-18",
    "titleVi": "19. Kênh hỗ trợ",
    "titleEn": "19. Kênh hỗ trợ",
    "articles": []
  },
  {
    "id": "cat-19",
    "titleVi": "20. Sơ đồ xử lý sự cố nhanh",
    "titleEn": "20. Sơ đồ xử lý sự cố nhanh",
    "articles": []
  },
  {
    "id": "cat-20",
    "titleVi": "21. Hướng dẫn tài khoản chi tiết",
    "titleEn": "21. Hướng dẫn tài khoản chi tiết",
    "articles": [
      {
        "id": "art-20-1",
        "titleVi": "21.1. Tạo tài khoản mới",
        "titleEn": "21.1. Tạo tài khoản mới",
        "htmlVi": "<ul>\n<li>Dùng email bạn có quyền truy cập.</li>\n<li>Nhập mật khẩu theo yêu cầu hiển thị.</li>\n<li>Không dùng mật khẩu giống email, tên hiển thị hoặc mật khẩu của dịch vụ quan trọng khác.</li>\n<li>Gửi biểu mẫu một lần và chờ phản hồi.</li>\n<li>Nếu gặp <code>CONFLICT</code>, email có thể đã tồn tại.</li>\n<li>Nếu gặp <code>INVALID_INPUT</code>, kiểm tra định dạng email và các trường bắt buộc.</li>\n</ul>\n<p>Báo cáo đặt mục tiêu quy trình đăng ký cơ bản bằng email và mật khẩu, nhưng không xác nhận đầy đủ email verification, CAPTCHA hoặc phục hồi mật khẩu. Chỉ hướng dẫn các nút thực sự có trong giao diện của bản triển khai.</p>\n",
        "htmlEn": "<ul>\n<li>Dùng email bạn có quyền truy cập.</li>\n<li>Nhập mật khẩu theo yêu cầu hiển thị.</li>\n<li>Không dùng mật khẩu giống email, tên hiển thị hoặc mật khẩu của dịch vụ quan trọng khác.</li>\n<li>Gửi biểu mẫu một lần và chờ phản hồi.</li>\n<li>Nếu gặp <code>CONFLICT</code>, email có thể đã tồn tại.</li>\n<li>Nếu gặp <code>INVALID_INPUT</code>, kiểm tra định dạng email và các trường bắt buộc.</li>\n</ul>\n<p>Báo cáo đặt mục tiêu quy trình đăng ký cơ bản bằng email và mật khẩu, nhưng không xác nhận đầy đủ email verification, CAPTCHA hoặc phục hồi mật khẩu. Chỉ hướng dẫn các nút thực sự có trong giao diện của bản triển khai.</p>\n"
      },
      {
        "id": "art-20-2",
        "titleVi": "21.2. Kiểm tra phiên đang hoạt động",
        "titleEn": "21.2. Kiểm tra phiên đang hoạt động",
        "htmlVi": "<p>Khi giao diện quản lý phiên được bật:</p>\n<ol>\n<li>Mở cài đặt tài khoản;</li>\n<li>Vào mục phiên hoặc thiết bị;</li>\n<li>So sánh thiết bị, IP và thời điểm;</li>\n<li>Thu hồi phiên không nhận ra;</li>\n<li>Đổi mật khẩu nếu nghi ngờ lộ thông tin;</li>\n<li>Đăng xuất và đăng nhập lại.</li>\n</ol>\n<p>Không xem IP là bằng chứng tuyệt đối về người dùng vì mạng di động, VPN hoặc mạng dùng chung có thể thay đổi địa chỉ.</p>\n",
        "htmlEn": "<p>Khi giao diện quản lý phiên được bật:</p>\n<ol>\n<li>Mở cài đặt tài khoản;</li>\n<li>Vào mục phiên hoặc thiết bị;</li>\n<li>So sánh thiết bị, IP và thời điểm;</li>\n<li>Thu hồi phiên không nhận ra;</li>\n<li>Đổi mật khẩu nếu nghi ngờ lộ thông tin;</li>\n<li>Đăng xuất và đăng nhập lại.</li>\n</ol>\n<p>Không xem IP là bằng chứng tuyệt đối về người dùng vì mạng di động, VPN hoặc mạng dùng chung có thể thay đổi địa chỉ.</p>\n"
      },
      {
        "id": "art-20-3",
        "titleVi": "21.3. Đăng xuất ở một tab nhưng tab khác vẫn hiển thị trạng thái cũ",
        "titleEn": "21.3. Đăng xuất ở một tab nhưng tab khác vẫn hiển thị trạng thái cũ",
        "htmlVi": "<p>Cơ chế refresh-token rotation có phối hợp giữa các tab, nhưng báo cáo thừa nhận trạng thái giao diện đăng nhập/đăng xuất không luôn đồng bộ tức thời. Hãy:</p>\n<ul>\n<li>Tải lại tab còn lại;</li>\n<li>Đóng các tab cũ;</li>\n<li>Thu hồi phiên nếu vẫn còn truy cập;</li>\n<li>Xóa dữ liệu trang chỉ khi cần và sau khi đã lưu công việc chưa gửi.</li>\n</ul>\n",
        "htmlEn": "<p>Cơ chế refresh-token rotation có phối hợp giữa các tab, nhưng báo cáo thừa nhận trạng thái giao diện đăng nhập/đăng xuất không luôn đồng bộ tức thời. Hãy:</p>\n<ul>\n<li>Tải lại tab còn lại;</li>\n<li>Đóng các tab cũ;</li>\n<li>Thu hồi phiên nếu vẫn còn truy cập;</li>\n<li>Xóa dữ liệu trang chỉ khi cần và sau khi đã lưu công việc chưa gửi.</li>\n</ul>\n"
      },
      {
        "id": "art-20-4",
        "titleVi": "21.4. Không đăng nhập được dù mật khẩu đúng",
        "titleEn": "21.4. Không đăng nhập được dù mật khẩu đúng",
        "htmlVi": "<p>Có thể do:</p>\n<ul>\n<li>Access token cũ hết hạn;</li>\n<li>Phiên đã bị thu hồi;</li>\n<li>Refresh token không còn hợp lệ sau rotation;</li>\n<li>Đồng hồ thiết bị sai nhiều;</li>\n<li>Gateway từ chối issuer, audience hoặc signature;</li>\n<li>Dịch vụ xác thực chưa sẵn sàng;</li>\n<li>Bạn đang dùng tài khoản ở database khác của môi trường demo.</li>\n</ul>\n<p>Hãy thử đăng xuất hoàn toàn, tải lại trang và đăng nhập lại. Không gửi token cho người hỗ trợ.</p>\n",
        "htmlEn": "<p>Có thể do:</p>\n<ul>\n<li>Access token cũ hết hạn;</li>\n<li>Phiên đã bị thu hồi;</li>\n<li>Refresh token không còn hợp lệ sau rotation;</li>\n<li>Đồng hồ thiết bị sai nhiều;</li>\n<li>Gateway từ chối issuer, audience hoặc signature;</li>\n<li>Dịch vụ xác thực chưa sẵn sàng;</li>\n<li>Bạn đang dùng tài khoản ở database khác của môi trường demo.</li>\n</ul>\n<p>Hãy thử đăng xuất hoàn toàn, tải lại trang và đăng nhập lại. Không gửi token cho người hỗ trợ.</p>\n"
      }
    ]
  },
  {
    "id": "cat-21",
    "titleVi": "22. Hồ sơ và quyền hiển thị",
    "titleEn": "22. Hồ sơ và quyền hiển thị",
    "articles": [
      {
        "id": "art-21-1",
        "titleVi": "22.1. Hồ sơ không cập nhật",
        "titleEn": "22.1. Hồ sơ không cập nhật",
        "htmlVi": "<ol>\n<li>Kiểm tra trường dữ liệu có được hỗ trợ không;</li>\n<li>Bảo đảm bạn đang sửa hồ sơ của chính mình;</li>\n<li>Kiểm tra lỗi validation;</li>\n<li>Chờ cache hết hiệu lực hoặc tải lại;</li>\n<li>Kiểm tra ảnh hồ sơ đã chuyển từ pending sang committed chưa.</li>\n</ol>\n",
        "htmlEn": "<ol>\n<li>Kiểm tra trường dữ liệu có được hỗ trợ không;</li>\n<li>Bảo đảm bạn đang sửa hồ sơ của chính mình;</li>\n<li>Kiểm tra lỗi validation;</li>\n<li>Chờ cache hết hiệu lực hoặc tải lại;</li>\n<li>Kiểm tra ảnh hồ sơ đã chuyển từ pending sang committed chưa.</li>\n</ol>\n"
      },
      {
        "id": "art-21-2",
        "titleVi": "22.2. Ảnh hồ sơ tải lên nhưng không hiển thị",
        "titleEn": "22.2. Ảnh hồ sơ tải lên nhưng không hiển thị",
        "htmlVi": "<p>Tệp có thể đã được tải lên thành công nhưng thao tác gắn vào hồ sơ thất bại. Khi đó asset vẫn ở trạng thái pending và có thể bị dọn sau khi hết hạn. Thử tải lại bằng tệp hợp lệ và hoàn tất thao tác cập nhật hồ sơ.</p>\n",
        "htmlEn": "<p>Tệp có thể đã được tải lên thành công nhưng thao tác gắn vào hồ sơ thất bại. Khi đó asset vẫn ở trạng thái pending và có thể bị dọn sau khi hết hạn. Thử tải lại bằng tệp hợp lệ và hoàn tất thao tác cập nhật hồ sơ.</p>\n"
      },
      {
        "id": "art-21-3",
        "titleVi": "22.3. Người bị chặn vẫn xuất hiện ở một số nơi",
        "titleEn": "22.3. Người bị chặn vẫn xuất hiện ở một số nơi",
        "htmlVi": "<p>Chặn phải được áp dụng khi truy xuất nội dung, hồ sơ và quan hệ được bảo vệ. Tuy nhiên, dữ liệu đã cache, thông báo cũ hoặc chỉ mục có thể mất thời gian ngắn để đồng bộ. Nếu người bị chặn vẫn truy cập được nội dung mới, hãy báo lỗi kèm mã người dùng, thời gian và đường dẫn, không gửi dữ liệu nhạy cảm.</p>\n",
        "htmlEn": "<p>Chặn phải được áp dụng khi truy xuất nội dung, hồ sơ và quan hệ được bảo vệ. Tuy nhiên, dữ liệu đã cache, thông báo cũ hoặc chỉ mục có thể mất thời gian ngắn để đồng bộ. Nếu người bị chặn vẫn truy cập được nội dung mới, hãy báo lỗi kèm mã người dùng, thời gian và đường dẫn, không gửi dữ liệu nhạy cảm.</p>\n"
      }
    ]
  },
  {
    "id": "cat-22",
    "titleVi": "23. Bảng tin và bài viết",
    "titleEn": "23. Bảng tin và bài viết",
    "articles": [
      {
        "id": "art-22-1",
        "titleVi": "23.1. Bảng tin trống",
        "titleEn": "23.1. Bảng tin trống",
        "htmlVi": "<p>Các nguyên nhân thường gặp:</p>\n<ul>\n<li>Tài khoản chưa có bạn bè hoặc người theo dõi phù hợp;</li>\n<li>Không có bài viết trong phạm vi quyền xem;</li>\n<li>Các nguồn nội dung đã bị chặn;</li>\n<li>Dịch vụ Social Graph hoặc Recommendation chưa có dữ liệu;</li>\n<li>Phân trang đang ở trang không còn phần tử;</li>\n<li>Chỉ mục hoặc dữ liệu demo chưa được seed.</li>\n</ul>\n",
        "htmlEn": "<p>Các nguyên nhân thường gặp:</p>\n<ul>\n<li>Tài khoản chưa có bạn bè hoặc người theo dõi phù hợp;</li>\n<li>Không có bài viết trong phạm vi quyền xem;</li>\n<li>Các nguồn nội dung đã bị chặn;</li>\n<li>Dịch vụ Social Graph hoặc Recommendation chưa có dữ liệu;</li>\n<li>Phân trang đang ở trang không còn phần tử;</li>\n<li>Chỉ mục hoặc dữ liệu demo chưa được seed.</li>\n</ul>\n"
      },
      {
        "id": "art-22-2",
        "titleVi": "23.2. Bài viết đăng thành công nhưng chưa có trên bảng tin",
        "titleEn": "23.2. Bài viết đăng thành công nhưng chưa có trên bảng tin",
        "htmlVi": "<ul>\n<li>Bài viết có thể ở chế độ <strong>Chỉ mình tôi</strong>.</li>\n<li>Feed có thể dùng cache.</li>\n<li>Event đồng bộ sang Search hoặc Recommendation chưa xử lý xong.</li>\n<li>Bạn đang xem một trang feed cũ.</li>\n<li>Bài viết có media nhưng asset chưa committed.</li>\n</ul>\n<p>Mở trang hồ sơ của bạn để kiểm tra bài viết gốc trước khi tạo lại. Việc tạo lại nhiều lần có thể gây bài trùng.</p>\n",
        "htmlEn": "<ul>\n<li>Bài viết có thể ở chế độ <strong>Chỉ mình tôi</strong>.</li>\n<li>Feed có thể dùng cache.</li>\n<li>Event đồng bộ sang Search hoặc Recommendation chưa xử lý xong.</li>\n<li>Bạn đang xem một trang feed cũ.</li>\n<li>Bài viết có media nhưng asset chưa committed.</li>\n</ul>\n<p>Mở trang hồ sơ của bạn để kiểm tra bài viết gốc trước khi tạo lại. Việc tạo lại nhiều lần có thể gây bài trùng.</p>\n"
      },
      {
        "id": "art-22-3",
        "titleVi": "23.3. Tạo bài viết an toàn",
        "titleEn": "23.3. Tạo bài viết an toàn",
        "htmlVi": "<ol>\n<li>Nhập nội dung;</li>\n<li>Tải media nếu cần;</li>\n<li>Chờ upload hoàn tất;</li>\n<li>Kiểm tra preview;</li>\n<li>Chọn đối tượng xem;</li>\n<li>Đọc lại nhãn đối tượng;</li>\n<li>Nhấn đăng một lần;</li>\n<li>Chờ phản hồi thành công;</li>\n<li>Mở bài viết để xác nhận media và quyền hiển thị.</li>\n</ol>\n",
        "htmlEn": "<ol>\n<li>Nhập nội dung;</li>\n<li>Tải media nếu cần;</li>\n<li>Chờ upload hoàn tất;</li>\n<li>Kiểm tra preview;</li>\n<li>Chọn đối tượng xem;</li>\n<li>Đọc lại nhãn đối tượng;</li>\n<li>Nhấn đăng một lần;</li>\n<li>Chờ phản hồi thành công;</li>\n<li>Mở bài viết để xác nhận media và quyền hiển thị.</li>\n</ol>\n"
      },
      {
        "id": "art-22-4",
        "titleVi": "23.4. Bài viết có lỗi quyền riêng tư",
        "titleEn": "23.4. Bài viết có lỗi quyền riêng tư",
        "htmlVi": "<p>Ghi lại:</p>\n<ul>\n<li>Lựa chọn đã đặt;</li>\n<li>Người xem nào truy cập được hoặc không truy cập được;</li>\n<li>Trạng thái bạn bè/theo dõi/chặn tại thời điểm đó;</li>\n<li>Bài viết có xuất hiện trong Search, Recommendation, Notification hay qua URL trực tiếp không;</li>\n<li>Thời gian và mã tương quan.</li>\n</ul>\n<p>Đây là lỗi ưu tiên cao vì có thể liên quan đến truy cập trái phép.</p>\n",
        "htmlEn": "<p>Ghi lại:</p>\n<ul>\n<li>Lựa chọn đã đặt;</li>\n<li>Người xem nào truy cập được hoặc không truy cập được;</li>\n<li>Trạng thái bạn bè/theo dõi/chặn tại thời điểm đó;</li>\n<li>Bài viết có xuất hiện trong Search, Recommendation, Notification hay qua URL trực tiếp không;</li>\n<li>Thời gian và mã tương quan.</li>\n</ul>\n<p>Đây là lỗi ưu tiên cao vì có thể liên quan đến truy cập trái phép.</p>\n"
      }
    ]
  },
  {
    "id": "cat-23",
    "titleVi": "24. Giải thích chi tiết bốn mức đối tượng xem",
    "titleEn": "24. Giải thích chi tiết bốn mức đối tượng xem",
    "articles": [
      {
        "id": "art-23-1",
        "titleVi": "Công khai",
        "titleEn": "Công khai",
        "htmlVi": "<p>Dành cho người dùng có thể truy cập nội dung công khai theo cấu hình của bản triển khai. Chặn và trạng thái nội dung vẫn được áp dụng. Không nên hiểu “Công khai” là mọi người trên Internet luôn xem được khi chưa đăng nhập.</p>\n",
        "htmlEn": "<p>Dành cho người dùng có thể truy cập nội dung công khai theo cấu hình của bản triển khai. Chặn và trạng thái nội dung vẫn được áp dụng. Không nên hiểu “Công khai” là mọi người trên Internet luôn xem được khi chưa đăng nhập.</p>\n"
      },
      {
        "id": "art-23-2",
        "titleVi": "Bạn bè và người theo dõi",
        "titleEn": "Bạn bè và người theo dõi",
        "htmlVi": "<p>Cho phép bạn bè và người theo dõi hợp lệ. Người dùng khác không thuộc hai nhóm này không được xem. Nếu quan hệ thay đổi, quyền xem ở lần truy xuất sau có thể thay đổi.</p>\n",
        "htmlEn": "<p>Cho phép bạn bè và người theo dõi hợp lệ. Người dùng khác không thuộc hai nhóm này không được xem. Nếu quan hệ thay đổi, quyền xem ở lần truy xuất sau có thể thay đổi.</p>\n"
      },
      {
        "id": "art-23-3",
        "titleVi": "Chỉ bạn bè",
        "titleEn": "Chỉ bạn bè",
        "htmlVi": "<p>Chỉ bạn bè đã được xác nhận. Yêu cầu kết bạn đang chờ, người theo dõi hoặc tài khoản lạ không được xem.</p>\n",
        "htmlEn": "<p>Chỉ bạn bè đã được xác nhận. Yêu cầu kết bạn đang chờ, người theo dõi hoặc tài khoản lạ không được xem.</p>\n"
      },
      {
        "id": "art-23-4",
        "titleVi": "Chỉ mình tôi",
        "titleEn": "Chỉ mình tôi",
        "htmlVi": "<p>Chỉ chủ bài viết. Search, Recommendation, Notification và URL media không được phép làm lộ nội dung cho người khác.</p>\n",
        "htmlEn": "<p>Chỉ chủ bài viết. Search, Recommendation, Notification và URL media không được phép làm lộ nội dung cho người khác.</p>\n"
      }
    ]
  },
  {
    "id": "cat-24",
    "titleVi": "25. Bạn bè, theo dõi và chặn",
    "titleEn": "25. Bạn bè, theo dõi và chặn",
    "articles": [
      {
        "id": "art-24-1",
        "titleVi": "25.1. Yêu cầu kết bạn bị kẹt",
        "titleEn": "25.1. Yêu cầu kết bạn bị kẹt",
        "htmlVi": "<ul>\n<li>Kiểm tra bạn đã gửi trước đó chưa;</li>\n<li>Người nhận có thể đã từ chối hoặc chặn;</li>\n<li>Thao tác có thể bị rate limit;</li>\n<li>Dữ liệu quan hệ có thể chưa đồng bộ;</li>\n<li>Tài khoản đích có thể không còn tồn tại.</li>\n</ul>\n",
        "htmlEn": "<ul>\n<li>Kiểm tra bạn đã gửi trước đó chưa;</li>\n<li>Người nhận có thể đã từ chối hoặc chặn;</li>\n<li>Thao tác có thể bị rate limit;</li>\n<li>Dữ liệu quan hệ có thể chưa đồng bộ;</li>\n<li>Tài khoản đích có thể không còn tồn tại.</li>\n</ul>\n"
      },
      {
        "id": "art-24-2",
        "titleVi": "25.2. Không thể chấp nhận yêu cầu",
        "titleEn": "25.2. Không thể chấp nhận yêu cầu",
        "htmlVi": "<p>Có thể yêu cầu đã bị người gửi hủy, đã được xử lý ở tab khác hoặc quan hệ hiện tại xung đột. Tải lại danh sách trước khi thử lại.</p>\n",
        "htmlEn": "<p>Có thể yêu cầu đã bị người gửi hủy, đã được xử lý ở tab khác hoặc quan hệ hiện tại xung đột. Tải lại danh sách trước khi thử lại.</p>\n"
      },
      {
        "id": "art-24-3",
        "titleVi": "25.3. Theo dõi khác kết bạn thế nào?",
        "titleEn": "25.3. Theo dõi khác kết bạn thế nào?",
        "htmlVi": "<p>Kết bạn thường là quan hệ hai chiều sau khi chấp nhận. Theo dõi có thể là quan hệ một chiều. Quyền <strong>Bạn bè và người theo dõi</strong> cho phép cả hai nhóm; <strong>Chỉ bạn bè</strong> không tự cho phép follower.</p>\n",
        "htmlEn": "<p>Kết bạn thường là quan hệ hai chiều sau khi chấp nhận. Theo dõi có thể là quan hệ một chiều. Quyền <strong>Bạn bè và người theo dõi</strong> cho phép cả hai nhóm; <strong>Chỉ bạn bè</strong> không tự cho phép follower.</p>\n"
      },
      {
        "id": "art-24-4",
        "titleVi": "25.4. Chặn có tác dụng gì?",
        "titleEn": "25.4. Chặn có tác dụng gì?",
        "htmlVi": "<p>Chặn được dùng để ngăn tương tác và truy cập nội dung hạn chế theo mô hình dự án. Chặn không thể thu hồi bản sao người khác đã lưu ngoài Fakebook. Nếu tài khoản khác được tạo để né chặn, hãy báo cáo hành vi.</p>\n",
        "htmlEn": "<p>Chặn được dùng để ngăn tương tác và truy cập nội dung hạn chế theo mô hình dự án. Chặn không thể thu hồi bản sao người khác đã lưu ngoài Fakebook. Nếu tài khoản khác được tạo để né chặn, hãy báo cáo hành vi.</p>\n"
      }
    ]
  },
  {
    "id": "cat-25",
    "titleVi": "26. Tìm kiếm chi tiết",
    "titleEn": "26. Tìm kiếm chi tiết",
    "articles": [
      {
        "id": "art-25-1",
        "titleVi": "26.1. Đối tượng được hỗ trợ",
        "titleEn": "26.1. Đối tượng được hỗ trợ",
        "htmlVi": "<p>Search được thiết kế cho người dùng, nhóm, feed post, group post và reel. Một số loại có thể chưa có dữ liệu hoặc chưa bật ở giao diện.</p>\n",
        "htmlEn": "<p>Search được thiết kế cho người dùng, nhóm, feed post, group post và reel. Một số loại có thể chưa có dữ liệu hoặc chưa bật ở giao diện.</p>\n"
      },
      {
        "id": "art-25-2",
        "titleVi": "26.2. Cách cải thiện kết quả",
        "titleEn": "26.2. Cách cải thiện kết quả",
        "htmlVi": "<ul>\n<li>Dùng từ khóa ngắn, đúng chính tả;</li>\n<li>Thử tên hiển thị hoặc từ chính trong bài viết;</li>\n<li>Bỏ ký tự đặc biệt không cần thiết;</li>\n<li>Thử lại khi chỉ mục đã cập nhật;</li>\n<li>Kiểm tra quyền riêng tư và chặn.</li>\n</ul>\n<p>Search hiện hạn chế với lỗi chính tả, từ đồng nghĩa, đa ngôn ngữ và truy vấn tự nhiên. Không nên kỳ vọng hiểu câu hỏi phức tạp như công cụ tìm kiếm thương mại.</p>\n",
        "htmlEn": "<ul>\n<li>Dùng từ khóa ngắn, đúng chính tả;</li>\n<li>Thử tên hiển thị hoặc từ chính trong bài viết;</li>\n<li>Bỏ ký tự đặc biệt không cần thiết;</li>\n<li>Thử lại khi chỉ mục đã cập nhật;</li>\n<li>Kiểm tra quyền riêng tư và chặn.</li>\n</ul>\n<p>Search hiện hạn chế với lỗi chính tả, từ đồng nghĩa, đa ngôn ngữ và truy vấn tự nhiên. Không nên kỳ vọng hiểu câu hỏi phức tạp như công cụ tìm kiếm thương mại.</p>\n"
      },
      {
        "id": "art-25-3",
        "titleVi": "26.3. Kết quả có nhưng mở ra `FORBIDDEN`",
        "titleEn": "26.3. Kết quả có nhưng mở ra `FORBIDDEN`",
        "htmlVi": "<p>Chỉ mục có thể chứa metadata cũ, trong khi quyền hiện tại đã thay đổi. Đây là hành vi an toàn hơn so với hiển thị nội dung. Nếu kết quả không biến mất sau thời gian hợp lý, báo lỗi đồng bộ Search.</p>\n",
        "htmlEn": "<p>Chỉ mục có thể chứa metadata cũ, trong khi quyền hiện tại đã thay đổi. Đây là hành vi an toàn hơn so với hiển thị nội dung. Nếu kết quả không biến mất sau thời gian hợp lý, báo lỗi đồng bộ Search.</p>\n"
      },
      {
        "id": "art-25-4",
        "titleVi": "26.4. Lựa chọn kết quả được ghi thế nào?",
        "titleEn": "26.4. Lựa chọn kết quả được ghi thế nào?",
        "htmlVi": "<p>User story mô tả việc ghi một lựa chọn tối đa một lần cho cùng kết quả trong một ngày UTC để hạn chế làm phồng tín hiệu bằng refresh lặp. Đây là tín hiệu xếp hạng, không phải bằng chứng nội dung đúng hoặc được xác minh.</p>\n",
        "htmlEn": "<p>User story mô tả việc ghi một lựa chọn tối đa một lần cho cùng kết quả trong một ngày UTC để hạn chế làm phồng tín hiệu bằng refresh lặp. Đây là tín hiệu xếp hạng, không phải bằng chứng nội dung đúng hoặc được xác minh.</p>\n"
      }
    ]
  },
  {
    "id": "cat-26",
    "titleVi": "27. Nhắn tin chi tiết",
    "titleEn": "27. Nhắn tin chi tiết",
    "articles": [
      {
        "id": "art-26-1",
        "titleVi": "27.1. Không mở được hội thoại",
        "titleEn": "27.1. Không mở được hội thoại",
        "htmlVi": "<ul>\n<li>Bạn không còn là thành viên;</li>\n<li>Mã hội thoại sai;</li>\n<li>Phiên hết hạn;</li>\n<li>Người dùng bị chặn hoặc quan hệ không còn cho phép thao tác;</li>\n<li>Dịch vụ Messaging chưa sẵn sàng;</li>\n<li>Dữ liệu thuộc môi trường khác.</li>\n</ul>\n",
        "htmlEn": "<ul>\n<li>Bạn không còn là thành viên;</li>\n<li>Mã hội thoại sai;</li>\n<li>Phiên hết hạn;</li>\n<li>Người dùng bị chặn hoặc quan hệ không còn cho phép thao tác;</li>\n<li>Dịch vụ Messaging chưa sẵn sàng;</li>\n<li>Dữ liệu thuộc môi trường khác.</li>\n</ul>\n"
      },
      {
        "id": "art-26-2",
        "titleVi": "27.2. Tin nhắn gửi một lần nhưng hiển thị hai lần",
        "titleEn": "27.2. Tin nhắn gửi một lần nhưng hiển thị hai lần",
        "htmlVi": "<p>Frontend có thể gửi lại khi mạng chập chờn. Backend nên dùng idempotency hoặc định danh để tránh tạo trùng. Tải lại để phân biệt lỗi hiển thị và bản ghi thật. Ghi lại mã tin nhắn nếu có.</p>\n",
        "htmlEn": "<p>Frontend có thể gửi lại khi mạng chập chờn. Backend nên dùng idempotency hoặc định danh để tránh tạo trùng. Tải lại để phân biệt lỗi hiển thị và bản ghi thật. Ghi lại mã tin nhắn nếu có.</p>\n"
      },
      {
        "id": "art-26-3",
        "titleVi": "27.3. Tin nhắn không đến tức thời",
        "titleEn": "27.3. Tin nhắn không đến tức thời",
        "htmlVi": "<p>GraphQL subscriptions dùng Server-Sent Events cho luồng được hỗ trợ. Kết nối có thể bị ngắt do tab ngủ, proxy, mạng di động hoặc server restart. Tin nhắn vẫn nên xuất hiện khi tải lại nếu đã lưu thành công.</p>\n",
        "htmlEn": "<p>GraphQL subscriptions dùng Server-Sent Events cho luồng được hỗ trợ. Kết nối có thể bị ngắt do tab ngủ, proxy, mạng di động hoặc server restart. Tin nhắn vẫn nên xuất hiện khi tải lại nếu đã lưu thành công.</p>\n"
      },
      {
        "id": "art-26-4",
        "titleVi": "27.4. Tin nhắn có mã hóa đầu cuối không?",
        "titleEn": "27.4. Tin nhắn có mã hóa đầu cuối không?",
        "htmlVi": "<p>Báo cáo không xác nhận end-to-end encryption. Không gửi dữ liệu cực kỳ nhạy cảm chỉ dựa trên giả định rằng người vận hành kỹ thuật không thể truy cập nội dung.</p>\n",
        "htmlEn": "<p>Báo cáo không xác nhận end-to-end encryption. Không gửi dữ liệu cực kỳ nhạy cảm chỉ dựa trên giả định rằng người vận hành kỹ thuật không thể truy cập nội dung.</p>\n"
      }
    ]
  },
  {
    "id": "cat-27",
    "titleVi": "28. Thông báo chi tiết",
    "titleEn": "28. Thông báo chi tiết",
    "articles": [
      {
        "id": "art-27-1",
        "titleVi": "28.1. Thông báo đã đọc nhưng quay lại chưa đọc",
        "titleEn": "28.1. Thông báo đã đọc nhưng quay lại chưa đọc",
        "htmlVi": "<p>Có thể cập nhật trạng thái chưa được lưu, tab khác có dữ liệu cũ hoặc cache chưa đồng bộ. Thử tải lại và thao tác lại một lần.</p>\n",
        "htmlEn": "<p>Có thể cập nhật trạng thái chưa được lưu, tab khác có dữ liệu cũ hoặc cache chưa đồng bộ. Thử tải lại và thao tác lại một lần.</p>\n"
      },
      {
        "id": "art-27-2",
        "titleVi": "28.2. Thông báo mở ra nội dung không còn tồn tại",
        "titleEn": "28.2. Thông báo mở ra nội dung không còn tồn tại",
        "htmlVi": "<p>Bài viết có thể đã bị xóa hoặc quyền xem đã đổi. Thông báo không bảo đảm đối tượng đích còn truy cập được.</p>\n",
        "htmlEn": "<p>Bài viết có thể đã bị xóa hoặc quyền xem đã đổi. Thông báo không bảo đảm đối tượng đích còn truy cập được.</p>\n"
      },
      {
        "id": "art-27-3",
        "titleVi": "28.3. Không có thông báo dù thao tác đã xảy ra",
        "titleEn": "28.3. Không có thông báo dù thao tác đã xảy ra",
        "htmlVi": "<ul>\n<li>Loại sự kiện đó chưa được hỗ trợ;</li>\n<li>Worker xử lý nền chậm;</li>\n<li>Notification Service chưa chạy;</li>\n<li>Subscription bị ngắt;</li>\n<li>Người nhận không còn quyền với nội dung;</li>\n<li>Dữ liệu demo không cấu hình tạo thông báo.</li>\n</ul>\n",
        "htmlEn": "<ul>\n<li>Loại sự kiện đó chưa được hỗ trợ;</li>\n<li>Worker xử lý nền chậm;</li>\n<li>Notification Service chưa chạy;</li>\n<li>Subscription bị ngắt;</li>\n<li>Người nhận không còn quyền với nội dung;</li>\n<li>Dữ liệu demo không cấu hình tạo thông báo.</li>\n</ul>\n"
      }
    ]
  },
  {
    "id": "cat-28",
    "titleVi": "29. Đề xuất nội dung",
    "titleEn": "29. Đề xuất nội dung",
    "articles": [
      {
        "id": "art-28-1",
        "titleVi": "29.1. Vì sao đề xuất lặp lại?",
        "titleEn": "29.1. Vì sao đề xuất lặp lại?",
        "htmlVi": "<p>Dữ liệu ứng viên và tương tác còn ít. Embedding và xếp hạng trong nguyên mẫu chưa được đánh giá dài hạn. Tương tác với nhiều nội dung khác nhau có thể làm thay đổi tín hiệu, nhưng báo cáo không xác nhận nút “Không quan tâm”.</p>\n",
        "htmlEn": "<p>Dữ liệu ứng viên và tương tác còn ít. Embedding và xếp hạng trong nguyên mẫu chưa được đánh giá dài hạn. Tương tác với nhiều nội dung khác nhau có thể làm thay đổi tín hiệu, nhưng báo cáo không xác nhận nút “Không quan tâm”.</p>\n"
      },
      {
        "id": "art-28-2",
        "titleVi": "29.2. Vì sao tài khoản mới có đề xuất kém?",
        "titleEn": "29.2. Vì sao tài khoản mới có đề xuất kém?",
        "htmlVi": "<p>Đó là cold start: hệ thống chưa có đủ tín hiệu người dùng. Có thể dùng nội dung phổ biến hoặc tín hiệu hồ sơ làm mặc định, nhưng chất lượng chưa thể giống nền tảng có dữ liệu lớn.</p>\n",
        "htmlEn": "<p>Đó là cold start: hệ thống chưa có đủ tín hiệu người dùng. Có thể dùng nội dung phổ biến hoặc tín hiệu hồ sơ làm mặc định, nhưng chất lượng chưa thể giống nền tảng có dữ liệu lớn.</p>\n"
      },
      {
        "id": "art-28-3",
        "titleVi": "29.3. Đề xuất có dùng tin nhắn riêng không?",
        "titleEn": "29.3. Đề xuất có dùng tin nhắn riêng không?",
        "htmlVi": "<p>Báo cáo không mô tả việc dùng nội dung tin nhắn riêng để tạo embedding đề xuất. Nếu sau này có thay đổi, chính sách quyền riêng tư phải được cập nhật rõ.</p>\n",
        "htmlEn": "<p>Báo cáo không mô tả việc dùng nội dung tin nhắn riêng để tạo embedding đề xuất. Nếu sau này có thay đổi, chính sách quyền riêng tư phải được cập nhật rõ.</p>\n"
      }
    ]
  },
  {
    "id": "cat-29",
    "titleVi": "30. Media và tệp đính kèm",
    "titleEn": "30. Media và tệp đính kèm",
    "articles": [
      {
        "id": "art-29-1",
        "titleVi": "30.1. Kiểm tra trước khi tải",
        "titleEn": "30.1. Kiểm tra trước khi tải",
        "htmlVi": "<ul>\n<li>Loại tệp được giao diện cho phép;</li>\n<li>Kích thước trong giới hạn hiển thị;</li>\n<li>Phần mở rộng phù hợp với nội dung thật;</li>\n<li>Tệp không bị hỏng;</li>\n<li>Tên tệp không chứa dữ liệu nhạy cảm không cần thiết;</li>\n<li>Bạn có quyền chia sẻ tệp.</li>\n</ul>\n",
        "htmlEn": "<ul>\n<li>Loại tệp được giao diện cho phép;</li>\n<li>Kích thước trong giới hạn hiển thị;</li>\n<li>Phần mở rộng phù hợp với nội dung thật;</li>\n<li>Tệp không bị hỏng;</li>\n<li>Tên tệp không chứa dữ liệu nhạy cảm không cần thiết;</li>\n<li>Bạn có quyền chia sẻ tệp.</li>\n</ul>\n"
      },
      {
        "id": "art-29-2",
        "titleVi": "30.2. Vì sao đổi đuôi tệp không giúp upload?",
        "titleEn": "30.2. Vì sao đổi đuôi tệp không giúp upload?",
        "htmlVi": "<p>Upload Server so sánh MIME, phần mở rộng và magic byte, đồng thời đọc luồng có giới hạn. Đổi <code>.exe</code> thành <code>.jpg</code> không biến tệp thành ảnh hợp lệ.</p>\n",
        "htmlEn": "<p>Upload Server so sánh MIME, phần mở rộng và magic byte, đồng thời đọc luồng có giới hạn. Đổi <code>.exe</code> thành <code>.jpg</code> không biến tệp thành ảnh hợp lệ.</p>\n"
      },
      {
        "id": "art-29-3",
        "titleVi": "30.3. Tệp pending là gì?",
        "titleEn": "30.3. Tệp pending là gì?",
        "htmlVi": "<p>Đó là tệp đã được upload nhưng chưa gắn với bài viết, hồ sơ hoặc tin nhắn. Tệp pending có thể bị hủy hoặc tự dọn khi hết hạn. Vì vậy, cần hoàn tất thao tác nghiệp vụ sau upload.</p>\n",
        "htmlEn": "<p>Đó là tệp đã được upload nhưng chưa gắn với bài viết, hồ sơ hoặc tin nhắn. Tệp pending có thể bị hủy hoặc tự dọn khi hết hạn. Vì vậy, cần hoàn tất thao tác nghiệp vụ sau upload.</p>\n"
      },
      {
        "id": "art-29-4",
        "titleVi": "30.4. URL tệp có phải là quyền truy cập không?",
        "titleEn": "30.4. URL tệp có phải là quyền truy cập không?",
        "htmlVi": "<p>Không. Quyền truy cập phải dựa trên chủ sở hữu và nội dung gốc. Nếu URL trực tiếp cho phép người không có quyền xem tệp, đó là lỗi bảo mật cần báo ngay.</p>\n",
        "htmlEn": "<p>Không. Quyền truy cập phải dựa trên chủ sở hữu và nội dung gốc. Nếu URL trực tiếp cho phép người không có quyền xem tệp, đó là lỗi bảo mật cần báo ngay.</p>\n"
      }
    ]
  },
  {
    "id": "cat-30",
    "titleVi": "31. Premium và thanh toán",
    "titleEn": "31. Premium và thanh toán",
    "articles": [
      {
        "id": "art-30-1",
        "titleVi": "31.1. Trạng thái đơn hàng",
        "titleEn": "31.1. Trạng thái đơn hàng",
        "htmlVi": "<p>Một đơn có thể ở trạng thái đang chờ, thành công, thất bại hoặc trạng thái khác theo triển khai. Không tạo lại đơn liên tục nếu chưa biết trạng thái; idempotency được dùng để tránh hiệu ứng lặp.</p>\n",
        "htmlEn": "<p>Một đơn có thể ở trạng thái đang chờ, thành công, thất bại hoặc trạng thái khác theo triển khai. Không tạo lại đơn liên tục nếu chưa biết trạng thái; idempotency được dùng để tránh hiệu ứng lặp.</p>\n"
      },
      {
        "id": "art-30-2",
        "titleVi": "31.2. Quay lại từ cổng thanh toán nhưng chưa kích hoạt",
        "titleEn": "31.2. Quay lại từ cổng thanh toán nhưng chưa kích hoạt",
        "htmlVi": "<p>Browser return chỉ là điều hướng. Chỉ webhook đã xác minh mới được dùng làm bằng chứng thanh toán theo thiết kế. Hãy chờ đồng bộ, tải lại trạng thái và cung cấp mã đơn cho nhóm phát triển.</p>\n",
        "htmlEn": "<p>Browser return chỉ là điều hướng. Chỉ webhook đã xác minh mới được dùng làm bằng chứng thanh toán theo thiết kế. Hãy chờ đồng bộ, tải lại trạng thái và cung cấp mã đơn cho nhóm phát triển.</p>\n"
      },
      {
        "id": "art-30-3",
        "titleVi": "31.3. Không dùng tiền thật trong môi trường demo khi chưa công bố",
        "titleEn": "31.3. Không dùng tiền thật trong môi trường demo khi chưa công bố",
        "htmlVi": "<p>Mã nguồn payment được mô tả là tắt mặc định và chưa được chứng minh bằng sandbox/live credentials trong workspace được rà soát. Chỉ bật thanh toán khi đã có nhà cung cấp, chính sách hoàn tiền, bảo mật webhook và quy trình hỗ trợ.</p>\n",
        "htmlEn": "<p>Mã nguồn payment được mô tả là tắt mặc định và chưa được chứng minh bằng sandbox/live credentials trong workspace được rà soát. Chỉ bật thanh toán khi đã có nhà cung cấp, chính sách hoàn tiền, bảo mật webhook và quy trình hỗ trợ.</p>\n"
      }
    ]
  },
  {
    "id": "cat-31",
    "titleVi": "32. Giao diện, mobile và khả năng tiếp cận",
    "titleEn": "32. Giao diện, mobile và khả năng tiếp cận",
    "articles": []
  },
  {
    "id": "cat-32",
    "titleVi": "33. Bảng chẩn đoán theo mã HTTP hoặc loại lỗi",
    "titleEn": "33. Bảng chẩn đoán theo mã HTTP hoặc loại lỗi",
    "articles": []
  },
  {
    "id": "cat-33",
    "titleVi": "34. Hướng dẫn báo lỗi bảo mật",
    "titleEn": "34. Hướng dẫn báo lỗi bảo mật",
    "articles": []
  },
  {
    "id": "cat-34",
    "titleVi": "35. Mẫu báo cáo lỗi kỹ thuật",
    "titleEn": "35. Mẫu báo cáo lỗi kỹ thuật",
    "articles": []
  },
  {
    "id": "cat-35",
    "titleVi": "36. Hướng dẫn cho môi trường demo và Docker",
    "titleEn": "36. Hướng dẫn cho môi trường demo và Docker",
    "articles": []
  },
  {
    "id": "cat-36",
    "titleVi": "37. Câu hỏi thường gặp mở rộng",
    "titleEn": "37. Câu hỏi thường gặp mở rộng",
    "articles": [
      {
        "id": "art-36-1",
        "titleVi": "Tôi có thể dùng Fakebook như dịch vụ chính thức không?",
        "titleEn": "Tôi có thể dùng Fakebook như dịch vụ chính thức không?",
        "htmlVi": "<p>Phiên bản được mô tả là nguyên mẫu học thuật. Chỉ dùng công khai sau khi hoàn thiện pháp lý, bảo mật, sao lưu, hỗ trợ, kiểm duyệt và vận hành.</p>\n",
        "htmlEn": "<p>Phiên bản được mô tả là nguyên mẫu học thuật. Chỉ dùng công khai sau khi hoàn thiện pháp lý, bảo mật, sao lưu, hỗ trợ, kiểm duyệt và vận hành.</p>\n"
      },
      {
        "id": "art-36-2",
        "titleVi": "Fakebook có hỗ trợ livestream hoặc gọi video không?",
        "titleEn": "Fakebook có hỗ trợ livestream hoặc gọi video không?",
        "htmlVi": "<p>Không trong phạm vi hiện tại.</p>\n",
        "htmlEn": "<p>Không trong phạm vi hiện tại.</p>\n"
      },
      {
        "id": "art-36-3",
        "titleVi": "Có marketplace hoặc quảng cáo không?",
        "titleEn": "Có marketplace hoặc quảng cáo không?",
        "htmlVi": "<p>Không. Đây là các chức năng bị loại khỏi phạm vi dự án.</p>\n",
        "htmlEn": "<p>Không. Đây là các chức năng bị loại khỏi phạm vi dự án.</p>\n"
      },
      {
        "id": "art-36-4",
        "titleVi": "Có xác thực vân tay hoặc khuôn mặt không?",
        "titleEn": "Có xác thực vân tay hoặc khuôn mặt không?",
        "htmlVi": "<p>Không. Biometric authentication không được triển khai.</p>\n",
        "htmlEn": "<p>Không. Biometric authentication không được triển khai.</p>\n"
      },
      {
        "id": "art-36-5",
        "titleVi": "Có danh sách “Bạn bè ngoại trừ…” không?",
        "titleEn": "Có danh sách “Bạn bè ngoại trừ…” không?",
        "htmlVi": "<p>Chưa. Mô hình hiện tại chỉ có bốn lựa chọn cơ bản.</p>\n",
        "htmlEn": "<p>Chưa. Mô hình hiện tại chỉ có bốn lựa chọn cơ bản.</p>\n"
      },
      {
        "id": "art-36-6",
        "titleVi": "Có thể phục hồi bài đã xóa không?",
        "titleEn": "Có thể phục hồi bài đã xóa không?",
        "htmlVi": "<p>Báo cáo chưa mô tả quy trình thùng rác hoặc khôi phục.</p>\n",
        "htmlEn": "<p>Báo cáo chưa mô tả quy trình thùng rác hoặc khôi phục.</p>\n"
      },
      {
        "id": "art-36-7",
        "titleVi": "Có thể xuất dữ liệu tài khoản không?",
        "titleEn": "Có thể xuất dữ liệu tài khoản không?",
        "htmlVi": "<p>Chưa được xác nhận.</p>\n",
        "htmlEn": "<p>Chưa được xác nhận.</p>\n"
      },
      {
        "id": "art-36-8",
        "titleVi": "Có thể xóa tài khoản vĩnh viễn không?",
        "titleEn": "Có thể xóa tài khoản vĩnh viễn không?",
        "htmlVi": "<p>Chưa có quy trình tự phục vụ được báo cáo.</p>\n",
        "htmlEn": "<p>Chưa có quy trình tự phục vụ được báo cáo.</p>\n"
      },
      {
        "id": "art-36-9",
        "titleVi": "Search có tìm được lỗi chính tả không?",
        "titleEn": "Search có tìm được lỗi chính tả không?",
        "htmlVi": "<p>Khả năng còn hạn chế.</p>\n",
        "htmlEn": "<p>Khả năng còn hạn chế.</p>\n"
      },
      {
        "id": "art-36-10",
        "titleVi": "Recommendation có giống Facebook không?",
        "titleEn": "Recommendation có giống Facebook không?",
        "htmlVi": "<p>Không. Đây là nguyên mẫu với embedding và tín hiệu hạn chế, chưa được đánh giá ở quy mô lớn.</p>\n",
        "htmlEn": "<p>Không. Đây là nguyên mẫu với embedding và tín hiệu hạn chế, chưa được đánh giá ở quy mô lớn.</p>\n"
      },
      {
        "id": "art-36-11",
        "titleVi": "Like và comment có phát ngay cho mọi người không?",
        "titleEn": "Like và comment có phát ngay cho mọi người không?",
        "htmlVi": "<p>Giao diện cập nhật sau API thành công, nhưng báo cáo không cam kết broadcast realtime cho mọi máy khách.</p>\n",
        "htmlEn": "<p>Giao diện cập nhật sau API thành công, nhưng báo cáo không cam kết broadcast realtime cho mọi máy khách.</p>\n"
      },
      {
        "id": "art-36-12",
        "titleVi": "Tin nhắn và thông báo có realtime không?",
        "titleEn": "Tin nhắn và thông báo có realtime không?",
        "htmlVi": "<p>Có hỗ trợ qua GraphQL subscriptions/SSE, nhưng có thể gián đoạn và chưa kiểm thử tải lớn.</p>\n",
        "htmlEn": "<p>Có hỗ trợ qua GraphQL subscriptions/SSE, nhưng có thể gián đoạn và chưa kiểm thử tải lớn.</p>\n"
      },
      {
        "id": "art-36-13",
        "titleVi": "Media có được quét virus không?",
        "titleEn": "Media có được quét virus không?",
        "htmlVi": "<p>Báo cáo mô tả validation loại tệp và luồng, không xác nhận antivirus cấp production.</p>\n",
        "htmlEn": "<p>Báo cáo mô tả validation loại tệp và luồng, không xác nhận antivirus cấp production.</p>\n"
      },
      {
        "id": "art-36-14",
        "titleVi": "Có CDN không?",
        "titleEn": "Có CDN không?",
        "htmlVi": "<p>Chưa được báo cáo.</p>\n",
        "htmlEn": "<p>Chưa được báo cáo.</p>\n"
      },
      {
        "id": "art-36-15",
        "titleVi": "Thanh toán đã dùng được chưa?",
        "titleEn": "Thanh toán đã dùng được chưa?",
        "htmlVi": "<p>Chức năng là minh họa học thuật, mặc định tắt trong source được rà soát và chưa chứng minh với credentials thực.</p>\n",
        "htmlEn": "<p>Chức năng là minh họa học thuật, mặc định tắt trong source được rà soát và chưa chứng minh với credentials thực.</p>\n"
      },
      {
        "id": "art-36-16",
        "titleVi": "Fakebook có hỗ trợ hàng triệu người dùng không?",
        "titleEn": "Fakebook có hỗ trợ hàng triệu người dùng không?",
        "htmlVi": "<p>Không có bằng chứng kiểm thử hoặc kiến trúc production để cam kết điều đó.</p>\n",
        "htmlEn": "<p>Không có bằng chứng kiểm thử hoặc kiến trúc production để cam kết điều đó.</p>\n"
      }
    ]
  },
  {
    "id": "cat-37",
    "titleVi": "38. Từ điển ngắn",
    "titleEn": "38. Từ điển ngắn",
    "articles": []
  }
].map((cat, idx) => ({
  ...cat,
  icon: icons[idx % icons.length],
  articles: cat.articles.map(art => ({
    ...art,
    contentVi: <div className="markdown-content" dangerouslySetInnerHTML={{ __html: art.htmlVi }} />,
    contentEn: <div className="markdown-content" dangerouslySetInnerHTML={{ __html: art.htmlEn }} />
  }))
}));
