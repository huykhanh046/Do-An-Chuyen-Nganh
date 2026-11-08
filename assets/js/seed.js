/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dữ liệu hạt giống (Seed Data) ban đầu cho hệ thống.
 * Không phụ thuộc fetch JSON để đảm bảo chạy mượt mà trên file:// và Live Server.
 */
window.HK_SEED_DATA = {
  products: [
    // 1. Áo thun
    {
      id: "sp-01",
      name: "Áo Thun Oversize Heavyweight Raw Edge",
      description: "Áo thun phom dáng Boxy Oversize đậm chất đường phố. Thiết kế tối giản với chi tiết viền raw edge thô mộc ở gấu áo và tay áo. Vải dệt tổ ong dày dặn, đứng phom và thấm hút mồ hôi cực tốt.",
      material: "100% Cotton Compact định lượng 260gsm",
      fit: "Boxy Oversize Fit",
      category: "ao-thun",
      categoryName: "Áo thun",
      price: 320000,
      originalPrice: 380000,
      rating: 4.9,
      reviewCount: 64,
      badge: "Bán chạy",
      status: "active",
      createdAt: "2026-09-15T08:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-01-s-black", sku: "HK-TEE-01-S-BLK", size: "S", colorName: "Đen Than", colorCode: "#111111", stock: 12 },
        { id: "var-01-m-black", sku: "HK-TEE-01-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 8 },
        { id: "var-01-l-black", sku: "HK-TEE-01-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 4 },
        { id: "var-01-m-white", sku: "HK-TEE-01-M-WHT", size: "M", colorName: "Trắng Ngà", colorCode: "#F5F5F0", stock: 15 },
        { id: "var-01-l-white", sku: "HK-TEE-01-L-WHT", size: "L", colorName: "Trắng Ngà", colorCode: "#F5F5F0", stock: 0 }
      ]
    },
    {
      id: "sp-02",
      name: "Áo Thun Acid Wash Vintage Concrete",
      description: "Áo thun xử lý wash acid thủ công mô phỏng bề mặt bê tông đô thị. Mỗi sản phẩm đều mang vân wash độc bản, cổ bo dệt 3.5cm chống dão cao cấp.",
      material: "100% Heavy Cotton 250gsm wash enzyme",
      fit: "Drop Shoulder Relaxed",
      category: "ao-thun",
      categoryName: "Áo thun",
      price: 350000,
      originalPrice: 420000,
      rating: 4.8,
      reviewCount: 38,
      badge: "Giảm giá",
      status: "active",
      createdAt: "2026-09-20T09:30:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-02-m-gray", sku: "HK-TEE-02-M-GRY", size: "M", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 7 },
        { id: "var-02-l-gray", sku: "HK-TEE-02-L-GRY", size: "L", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 3 },
        { id: "var-02-xl-gray", sku: "HK-TEE-02-XL-GRY", size: "XL", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 2 }
      ]
    },
    {
      id: "sp-03",
      name: "Áo Thun Minimal Typography Backprint",
      description: "Áo thun in slogan phong cách kiến trúc brutalist tối giản ở lưng áo. Mặt trước ngực trơn hoàn toàn, tôn lên phong thái điềm tĩnh và tự tin.",
      material: "100% Cotton 2 Cực 240gsm",
      fit: "Standard Oversize",
      category: "ao-thun",
      categoryName: "Áo thun",
      price: 290000,
      originalPrice: null,
      rating: 4.7,
      reviewCount: 22,
      badge: "Mới",
      status: "active",
      createdAt: "2026-10-01T10:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-03-s-black", sku: "HK-TEE-03-S-BLK", size: "S", colorName: "Đen Than", colorCode: "#111111", stock: 10 },
        { id: "var-03-m-black", sku: "HK-TEE-03-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 14 },
        { id: "var-03-l-black", sku: "HK-TEE-03-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 9 },
        { id: "var-03-m-cream", sku: "HK-TEE-03-M-CRM", size: "M", colorName: "Kem Cát", colorCode: "#D8CBB5", stock: 6 }
      ]
    },
    {
      id: "sp-04",
      name: "Áo Thun Mock-Neck Dài Tay Streetwear",
      description: "Thiết kế cổ lọ ngắn 3cm (mock-neck) tạo điểm nhấn thanh lịch nhưng không mất đi sự gai góc của phong cách đường phố. Thích hợp mặc layering hoặc mặc đơn.",
      material: "Cotton pha Spandex co giãn nhẹ 260gsm",
      fit: "Relaxed Boxy",
      category: "ao-thun",
      categoryName: "Áo thun",
      price: 360000,
      originalPrice: 400000,
      rating: 4.9,
      reviewCount: 19,
      badge: null,
      status: "active",
      createdAt: "2026-10-05T14:15:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1618354691438-25bc04584c03?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-04-m-black", sku: "HK-TEE-04-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 8 },
        { id: "var-04-l-black", sku: "HK-TEE-04-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 5 },
        { id: "var-04-l-white", sku: "HK-TEE-04-L-WHT", size: "L", colorName: "Trắng Ngà", colorCode: "#F5F5F0", stock: 4 }
      ]
    },

    // 2. Hoodie & Sweater
    {
      id: "sp-05",
      name: "Hoodie Heavy French Terry Double Layer Hood",
      description: "Chiếc hoodie chủ lực của HK Store. Mũ 2 lớp dày dặn đứng phom mà không cần dây rút rườm rà. Túi kangaroo may giấu đường chỉ tinh tế, bo gấu chặt chẽ.",
      material: "100% Cotton Da Cá French Terry 430gsm",
      fit: "Heavy Oversize",
      category: "hoodie-sweater",
      categoryName: "Hoodie & Sweater",
      price: 620000,
      originalPrice: 700000,
      rating: 5.0,
      reviewCount: 88,
      badge: "Bán chạy",
      status: "active",
      createdAt: "2026-09-10T12:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-05-m-black", sku: "HK-HD-05-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 10 },
        { id: "var-05-l-black", sku: "HK-HD-05-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 6 },
        { id: "var-05-xl-black", sku: "HK-HD-05-XL-BLK", size: "XL", colorName: "Đen Than", colorCode: "#111111", stock: 2 },
        { id: "var-05-m-olive", sku: "HK-HD-05-M-OLV", size: "M", colorName: "Xanh Rêu", colorCode: "#3E4F3D", stock: 5 },
        { id: "var-05-l-olive", sku: "HK-HD-05-L-OLV", size: "L", colorName: "Xanh Rêu", colorCode: "#3E4F3D", stock: 1 }
      ]
    },
    {
      id: "sp-06",
      name: "Sweater Boxy Fit Cổ Tròn Raw Seam",
      description: "Sweater phom ngắn ngang thắt lưng (cropped boxy) chuẩn phong cách modern streetwear. Đường may ngược raw seam tạo đường nét cấu trúc hình học rõ ràng.",
      material: "Vải Nỉ Chân Cua Cotton 380gsm",
      fit: "Cropped Boxy Fit",
      category: "hoodie-sweater",
      categoryName: "Hoodie & Sweater",
      price: 540000,
      originalPrice: null,
      rating: 4.8,
      reviewCount: 31,
      badge: "Mới",
      status: "active",
      createdAt: "2026-10-10T16:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-06-s-gray", sku: "HK-SW-06-S-GRY", size: "S", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 8 },
        { id: "var-06-m-gray", sku: "HK-SW-06-M-GRY", size: "M", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 11 },
        { id: "var-06-l-gray", sku: "HK-SW-06-L-GRY", size: "L", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 5 },
        { id: "var-06-m-brown", sku: "HK-SW-06-M-BRN", size: "M", colorName: "Nâu Đất", colorCode: "#5C4033", stock: 3 }
      ]
    },
    {
      id: "sp-07",
      name: "Zip Hoodie 2 Chiều Heavy Cotton Faded",
      description: "Áo hoodie có khóa kéo kim loại 2 chiều (2-way YKK zipper) cao cấp. Kỹ thuật wash xước màu tự nhiên, tay áo phồng xếp nếp thời thượng.",
      material: "Cotton Chải Kỹ 400gsm",
      fit: "Relaxed Wide Fit",
      category: "hoodie-sweater",
      categoryName: "Hoodie & Sweater",
      price: 680000,
      originalPrice: 750000,
      rating: 4.9,
      reviewCount: 42,
      badge: "Bán chạy",
      status: "active",
      createdAt: "2026-09-25T11:20:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-07-m-black", sku: "HK-ZIP-07-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 6 },
        { id: "var-07-l-black", sku: "HK-ZIP-07-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 4 },
        { id: "var-07-m-gray", sku: "HK-ZIP-07-M-GRY", size: "M", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 5 }
      ]
    },
    {
      id: "sp-08",
      name: "Sweater Khóa Kéo Cổ Polo Quarter-Zip",
      description: "Sweater cổ bẻ khóa kim loại 1/4 ngực tạo phong thái retro streetwear những năm 90s. Chất nỉ mềm mại giữ ấm hoàn hảo cho những ngày se lạnh.",
      material: "Nỉ Bông Cotton 350gsm",
      fit: "Oversize Vintage",
      category: "hoodie-sweater",
      categoryName: "Hoodie & Sweater",
      price: 520000,
      originalPrice: 590000,
      rating: 4.6,
      reviewCount: 15,
      badge: "Giảm giá",
      status: "active",
      createdAt: "2026-10-08T08:45:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-08-s-cream", sku: "HK-SW-08-S-CRM", size: "S", colorName: "Kem Cát", colorCode: "#D8CBB5", stock: 4 },
        { id: "var-08-m-cream", sku: "HK-SW-08-M-CRM", size: "M", colorName: "Kem Cát", colorCode: "#D8CBB5", stock: 7 },
        { id: "var-08-l-cream", sku: "HK-SW-08-L-CRM", size: "L", colorName: "Kem Cát", colorCode: "#D8CBB5", stock: 2 }
      ]
    },

    // 3. Quần (Pants)
    {
      id: "sp-09",
      name: "Quần Parachute Cargo Pants Multi-Pocket",
      description: "Quần dù ống rộng phong cách Gorpcore & Streetwear. Hệ thống 6 túi hộp tiện lợi, gấu quần có nút rút điều chỉnh thành dáng jogger hoặc wide-leg.",
      material: "Vải Dù Nylon Ripstop chống thấm nước nhẹ",
      fit: "Baggy Parachute Fit",
      category: "quan",
      categoryName: "Quần",
      price: 490000,
      originalPrice: 550000,
      rating: 4.9,
      reviewCount: 75,
      badge: "Bán chạy",
      status: "active",
      createdAt: "2026-09-12T13:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-09-s-black", sku: "HK-PAN-09-S-BLK", size: "S", colorName: "Đen Than", colorCode: "#111111", stock: 9 },
        { id: "var-09-m-black", sku: "HK-PAN-09-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 12 },
        { id: "var-09-l-black", sku: "HK-PAN-09-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 5 },
        { id: "var-09-m-olive", sku: "HK-PAN-09-M-OLV", size: "M", colorName: "Xanh Rêu", colorCode: "#3E4F3D", stock: 4 },
        { id: "var-09-l-olive", sku: "HK-PAN-09-L-OLV", size: "L", colorName: "Xanh Rêu", colorCode: "#3E4F3D", stock: 0 }
      ]
    },
    {
      id: "sp-10",
      name: "Quần Jean Baggy Denim Washed Indigo",
      description: "Quần jean ống rộng xếp ly ly nhẹ trước gối. Công nghệ giặt đá wash tạo độ ngả màu xanh vintage đậm chất đường phố thập niên 2000.",
      material: "100% Cotton Denim 13.5oz không giãn",
      fit: "Wide-leg Baggy",
      category: "quan",
      categoryName: "Quần",
      price: 580000,
      originalPrice: 650000,
      rating: 4.8,
      reviewCount: 53,
      badge: "Mới",
      status: "active",
      createdAt: "2026-10-02T15:30:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-10-s-blue", sku: "HK-JEAN-10-S-BLU", size: "S", colorName: "Xanh Indigo", colorCode: "#2A4B7C", stock: 7 },
        { id: "var-10-m-blue", sku: "HK-JEAN-10-M-BLU", size: "M", colorName: "Xanh Indigo", colorCode: "#2A4B7C", stock: 10 },
        { id: "var-10-l-blue", sku: "HK-JEAN-10-L-BLU", size: "L", colorName: "Xanh Indigo", colorCode: "#2A4B7C", stock: 6 },
        { id: "var-10-xl-blue", sku: "HK-JEAN-10-XL-BLU", size: "XL", colorName: "Xanh Indigo", colorCode: "#2A4B7C", stock: 2 }
      ]
    },
    {
      id: "sp-11",
      name: "Quần Suông Đen Minimalist Pleated Trousers",
      description: "Sự kết hợp giữa chất đường phố và âu phục tối giản. Quần tây ống suông xếp 2 ly sâu, chất vải rũ đứng phom, đi cùng sneaker cực kỳ tôn dáng.",
      material: "Vải Tuyết Mưa Hàn Quốc cao cấp",
      fit: "Straight Relaxed Fit",
      category: "quan",
      categoryName: "Quần",
      price: 450000,
      originalPrice: null,
      rating: 4.7,
      reviewCount: 29,
      badge: null,
      status: "active",
      createdAt: "2026-09-18T10:10:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-11-s-black", sku: "HK-TRO-11-S-BLK", size: "S", colorName: "Đen Than", colorCode: "#111111", stock: 8 },
        { id: "var-11-m-black", sku: "HK-TRO-11-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 9 },
        { id: "var-11-l-black", sku: "HK-TRO-11-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 4 }
      ]
    },
    {
      id: "sp-12",
      name: "Quần Short Cargo Heavy Cotton Túi Nổi",
      description: "Quần short dài qua gối (below-knee) phong cách skate/streetwear. Lưng thun kết hợp dây rút kim loại, túi hộp may nổi tạo hình khối mạnh mẽ.",
      material: "Khaki Cotton Dày 100%",
      fit: "Loose Skater Fit",
      category: "quan",
      categoryName: "Quần",
      price: 380000,
      originalPrice: 420000,
      rating: 4.9,
      reviewCount: 41,
      badge: "Giảm giá",
      status: "active",
      createdAt: "2026-09-28T09:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-12-m-black", sku: "HK-SHT-12-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 10 },
        { id: "var-12-l-black", sku: "HK-SHT-12-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 7 },
        { id: "var-12-m-cream", sku: "HK-SHT-12-M-CRM", size: "M", colorName: "Kem Cát", colorCode: "#D8CBB5", stock: 5 }
      ]
    },

    // 4. Áo khoác (Jackets)
    {
      id: "sp-13",
      name: "Áo Khoác Bomber MA-1 Oversize Minimal",
      description: "Thiết kế lấy cảm hứng từ áo phi công MA-1 nhưng giản lược mọi chi tiết rườm rà. Lớp lót trần bông hình quả trám ấm áp, bề mặt chống gió và nước nhẹ.",
      material: "Nylon Twill Matte cao cấp + Lót Bông Microfiber",
      fit: "Puffy Boxy Oversize",
      category: "ao-khoac",
      categoryName: "Áo khoác",
      price: 790000,
      originalPrice: 890000,
      rating: 5.0,
      reviewCount: 92,
      badge: "Bán chạy",
      status: "active",
      createdAt: "2026-09-08T11:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1548883354-7622d03aca27?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-13-m-black", sku: "HK-BMB-13-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 6 },
        { id: "var-13-l-black", sku: "HK-BMB-13-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 3 },
        { id: "var-13-m-olive", sku: "HK-BMB-13-M-OLV", size: "M", colorName: "Xanh Rêu", colorCode: "#3E4F3D", stock: 4 },
        { id: "var-13-l-olive", sku: "HK-BMB-13-L-OLV", size: "L", colorName: "Xanh Rêu", colorCode: "#3E4F3D", stock: 1 }
      ]
    },
    {
      id: "sp-14",
      name: "Áo Khoác Gió Gorpcore Windbreaker Kèm Mũ",
      description: "Áo khoác gió phong cách techwear/gorpcore đô thị. Khóa dán cổ tay, dây rút bo hông, khả năng trượt nước và cản gió hoàn hảo trong mọi điều kiện thời tiết.",
      material: "Polyester Chống Thấm Nước 3 Lớp",
      fit: "Relaxed Tech Fit",
      category: "ao-khoac",
      categoryName: "Áo khoác",
      price: 650000,
      originalPrice: null,
      rating: 4.8,
      reviewCount: 35,
      badge: "Mới",
      status: "active",
      createdAt: "2026-10-12T09:15:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-14-m-black", sku: "HK-WND-14-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 8 },
        { id: "var-14-l-black", sku: "HK-WND-14-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 5 },
        { id: "var-14-m-gray", sku: "HK-WND-14-M-GRY", size: "M", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 6 }
      ]
    },
    {
      id: "sp-15",
      name: "Áo Khoác Da Bóng Vegan Leather Biker Minimal",
      description: "Chiếc biker jacket bằng da thuần chay nhân tạo không gân, phom rũ cá tính. Khóa kéo chéo đặc trưng tôn lên nét phóng khoáng đầy chất chơi.",
      material: "Da Thuần Chay Vegan PU cao cấp không nổ",
      fit: "Oversize Dropped Shoulder",
      category: "ao-khoac",
      categoryName: "Áo khoác",
      price: 890000,
      originalPrice: 1050000,
      rating: 4.9,
      reviewCount: 27,
      badge: "Giảm giá",
      status: "active",
      createdAt: "2026-09-14T14:40:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-15-m-black", sku: "HK-LTH-15-M-BLK", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 4 },
        { id: "var-15-l-black", sku: "HK-LTH-15-L-BLK", size: "L", colorName: "Đen Than", colorCode: "#111111", stock: 2 }
      ]
    },
    {
      id: "sp-16",
      name: "Áo Khoác Denim Boxy Acid Wash",
      description: "Áo khoác jean phom rộng vuông vức, nút cài kim loại đúc mờ. Dễ dàng phối cùng hoodie hay áo thun cho phong cách layering ấn tượng.",
      material: "Denim Cotton 100% 14oz",
      fit: "Boxy Vintage Fit",
      category: "ao-khoac",
      categoryName: "Áo khoác",
      price: 720000,
      originalPrice: null,
      rating: 4.7,
      reviewCount: 18,
      badge: null,
      status: "active",
      createdAt: "2026-10-04T16:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-16-s-blue", sku: "HK-DNM-16-S-BLU", size: "S", colorName: "Xanh Indigo", colorCode: "#2A4B7C", stock: 5 },
        { id: "var-16-m-blue", sku: "HK-DNM-16-M-BLU", size: "M", colorName: "Xanh Indigo", colorCode: "#2A4B7C", stock: 6 },
        { id: "var-16-l-blue", sku: "HK-DNM-16-L-BLU", size: "L", colorName: "Xanh Indigo", colorCode: "#2A4B7C", stock: 3 }
      ]
    },

    // 5. Phụ kiện (Accessories)
    {
      id: "sp-17",
      name: "Mũ Lưỡi Trai Dad Hat Thêu Chữ Chìm HK",
      description: "Nón kết phom mềm cổ điển, khóa gài kim loại điều chỉnh độ rộng phía sau. Thêu logo chữ HK Store đơn sắc tone-sur-tone tinh giản.",
      material: "100% Khaki Cotton Twill",
      fit: "One Size (Điều chỉnh)",
      category: "phu-kien",
      categoryName: "Phụ kiện",
      price: 180000,
      originalPrice: 220000,
      rating: 4.9,
      reviewCount: 110,
      badge: "Bán chạy",
      status: "active",
      createdAt: "2026-09-01T08:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-17-one-black", sku: "HK-CAP-17-ONE-BLK", size: "One size", colorName: "Đen Than", colorCode: "#111111", stock: 25 },
        { id: "var-17-one-cream", sku: "HK-CAP-17-ONE-CRM", size: "One size", colorName: "Kem Cát", colorCode: "#D8CBB5", stock: 14 }
      ]
    },
    {
      id: "sp-18",
      name: "Túi Đeo Chéo Crossbody Nylon Chống Nước",
      description: "Túi đeo chéo form hộp nhỏ gọn nhưng chứa vừa điện thoại, ví, chìa khóa và phụ kiện cá nhân. Khóa nam ấn từ tính Fidlock phong cách Techwear.",
      material: "Cordura Nylon Chống Mài Mòn",
      fit: "Dây Tùy Chỉnh Độ Dài",
      category: "phu-kien",
      categoryName: "Phụ kiện",
      price: 350000,
      originalPrice: 390000,
      rating: 4.9,
      reviewCount: 84,
      badge: "Bán chạy",
      status: "active",
      createdAt: "2026-09-05T10:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-18-one-black", sku: "HK-BAG-18-ONE-BLK", size: "One size", colorName: "Đen Than", colorCode: "#111111", stock: 18 }
      ]
    },
    {
      id: "sp-19",
      name: "Mũ Len Beanie Dệt Kim Gân Nổi Minimal",
      description: "Mũ len ôm đầu dệt gân lớn giữ ấm cực tốt trong mùa lạnh. Phù hợp phối cùng trang phục layer cá tính.",
      material: "Sợi Acrylic Giữ Nhiệt Cao Cấp",
      fit: "Co Giãn Vừa Vặn",
      category: "phu-kien",
      categoryName: "Phụ kiện",
      price: 150000,
      originalPrice: null,
      rating: 4.8,
      reviewCount: 45,
      badge: "Mới",
      status: "active",
      createdAt: "2026-10-15T09:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-19-one-black", sku: "HK-BEN-19-ONE-BLK", size: "One size", colorName: "Đen Than", colorCode: "#111111", stock: 12 },
        { id: "var-19-one-gray", sku: "HK-BEN-19-ONE-GRY", size: "One size", colorName: "Xám Xi Măng", colorCode: "#8A8A8A", stock: 8 }
      ]
    },
    {
      id: "sp-20",
      name: "Thắt Lưng Dây Bản To Khóa Kim Loại Con Lăn",
      description: "Dây nịt vải bố Canvas dệt sợi mật độ cao, đầu khóa lăn bằng hợp kim sơn tĩnh điện mờ không rỉ sét. Chiều dài 125cm dễ cắt ngắn theo số đo.",
      material: "Dây Canvas Siêu Bền + Khóa Hợp Kim",
      fit: "Chiều Dài 125cm",
      category: "phu-kien",
      categoryName: "Phụ kiện",
      price: 160000,
      originalPrice: 190000,
      rating: 4.7,
      reviewCount: 33,
      badge: "Giảm giá",
      status: "active",
      createdAt: "2026-09-22T11:00:00.000Z",
      images: [
        "https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&auto=format&fit=crop&q=80"
      ],
      variants: [
        { id: "var-20-one-black", sku: "HK-BLT-20-ONE-BLK", size: "One size", colorName: "Đen Than", colorCode: "#111111", stock: 20 },
        { id: "var-20-one-olive", sku: "HK-BLT-20-ONE-OLV", size: "One size", colorName: "Xanh Rêu", colorCode: "#3E4F3D", stock: 5 }
      ]
    }
  ],

  users: [
    {
      id: "user-admin",
      fullName: "Quản trị viên HK",
      email: "admin@hkstore.vn",
      password: "admin1234",
      phone: "0965811846",
      address: "Showroom HK Store - 126 Thanh Vinh 10, Phường Hoà Khánh Bắc, TP. Đà Nẵng",
      role: "admin",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "user-cust-01",
      fullName: "Nguyễn Văn An",
      email: "khach1@hkstore.vn",
      password: "khach1234",
      phone: "0901234567",
      address: "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
      role: "customer",
      createdAt: "2026-08-15T10:00:00.000Z"
    },
    {
      id: "user-cust-02",
      fullName: "Trần Thị Mai",
      email: "khach2@hkstore.vn",
      password: "khach1234",
      phone: "0912345678",
      address: "45 Phố Huế, Phường Hàng Bài, Quận Hoàn Kiếm, Hà Nội",
      role: "customer",
      createdAt: "2026-09-01T14:20:00.000Z"
    }
  ],

  orders: [
    {
      id: "ORD-20260920-8812",
      userId: "user-cust-01",
      customerInfo: {
        fullName: "Nguyễn Văn An",
        email: "khach1@hkstore.vn",
        phone: "0901234567",
        address: "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        note: "Giao giờ hành chính, gọi trước 15 phút"
      },
      items: [
        {
          productId: "sp-01",
          variantId: "var-01-m-black",
          name: "Áo Thun Oversize Heavyweight Raw Edge",
          image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
          sku: "HK-TEE-01-M-BLK",
          size: "M",
          colorName: "Đen Than",
          price: 320000,
          quantity: 1,
          lineTotal: 320000
        },
        {
          productId: "sp-17",
          variantId: "var-17-one-black",
          name: "Mũ Lưỡi Trai Dad Hat Thêu Chữ Chìm HK",
          image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=80",
          sku: "HK-CAP-17-ONE-BLK",
          size: "One size",
          colorName: "Đen Than",
          price: 180000,
          quantity: 1,
          lineTotal: 180000
        }
      ],
      subtotal: 500000,
      shippingFee: 0,
      total: 500000,
      paymentMethod: "banking",
      paymentStatus: "paid", // "Chờ thanh toán" -> "Đã thanh toán"
      orderStatus: "delivered", // "Chờ xác nhận" -> "Đã xác nhận" -> "Đang giao" -> "Đã giao"
      createdAt: "2026-09-20T14:30:00.000Z",
      updatedAt: "2026-09-22T16:00:00.000Z"
    },
    {
      id: "ORD-20261015-4421",
      userId: "user-cust-01",
      customerInfo: {
        fullName: "Nguyễn Văn An",
        email: "khach1@hkstore.vn",
        phone: "0901234567",
        address: "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        note: ""
      },
      items: [
        {
          productId: "sp-05",
          variantId: "var-05-l-black",
          name: "Hoodie Heavy French Terry Double Layer Hood",
          image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
          sku: "HK-HD-05-L-BLK",
          size: "L",
          colorName: "Đen Than",
          price: 620000,
          quantity: 1,
          lineTotal: 620000
        }
      ],
      subtotal: 620000,
      shippingFee: 0,
      total: 620000,
      paymentMethod: "cod",
      paymentStatus: "pending",
      orderStatus: "shipping",
      createdAt: "2026-10-15T09:10:00.000Z",
      updatedAt: "2026-10-16T11:00:00.000Z"
    },
    {
      id: "ORD-20261025-1109",
      userId: "user-cust-01",
      customerInfo: {
        fullName: "Nguyễn Văn An",
        email: "khach1@hkstore.vn",
        phone: "0901234567",
        address: "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        note: "Đóng gói làm quà tặng giúp mình"
      },
      items: [
        {
          productId: "sp-09",
          variantId: "var-09-m-black",
          name: "Quần Parachute Cargo Pants Multi-Pocket",
          image: "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=800&auto=format&fit=crop&q=80",
          sku: "HK-PAN-09-M-BLK",
          size: "M",
          colorName: "Đen Than",
          price: 490000,
          quantity: 1,
          lineTotal: 490000
        }
      ],
      subtotal: 490000,
      shippingFee: 30000,
      total: 520000,
      paymentMethod: "gateway",
      paymentStatus: "paid",
      orderStatus: "pending", // Khách hàng có thể hủy đơn này vì ở trạng thái pending
      createdAt: "2026-10-25T19:00:00.000Z",
      updatedAt: "2026-10-25T19:00:00.000Z"
    }
  ]
};
