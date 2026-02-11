FactoryBot.define do
  factory :user do
    sequence(:twitter_uid) { |n| "uid_#{n}" }
    sequence(:twitter_handle) { |n| "user_#{n}" }
    display_name { "Test User" }
    avatar_url { "https://example.com/avatar.jpg" }
    follower_count { 100 }
    account_created_at { 2.years.ago }
    reputation_score { 0.0 }
    karma { 0.0 }
    sequence(:auth_token) { |n| SecureRandom.hex(32) }
  end
end
