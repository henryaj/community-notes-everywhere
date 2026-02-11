FactoryBot.define do
  factory :rating do
    association :user
    association :note
    helpfulness { :yes }
  end
end
