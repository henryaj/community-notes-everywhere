FactoryBot.define do
  factory :page do
    sequence(:url) { |n| "https://example.com/article-#{n}" }
    domain { "example.com" }
    title { "Test Article" }
  end
end
