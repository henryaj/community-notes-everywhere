FactoryBot.define do
  factory :note do
    body { "This claim needs additional context." }
    association :author, factory: :user
    association :page
    selected_text { "some highlighted text on the page" }
    text_prefix { "before the " }
    text_suffix { " on the page" }
    css_selector { "p.article-body" }
    status { :pending }
    helpful_count { 0 }
    not_helpful_count { 0 }
  end
end
