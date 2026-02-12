# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_12_180431) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "flipper_features", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_flipper_features_on_key", unique: true
  end

  create_table "flipper_gates", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "feature_key", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.text "value"
    t.index ["feature_key", "key", "value"], name: "index_flipper_gates_on_feature_key_and_key_and_value", unique: true
  end

  create_table "note_status_changes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "from_status", null: false
    t.integer "helpful_count_at_change"
    t.integer "not_helpful_count_at_change"
    t.bigint "note_id", null: false
    t.integer "somewhat_count_at_change"
    t.integer "to_status", null: false
    t.string "trigger"
    t.index ["note_id"], name: "index_note_status_changes_on_note_id"
  end

  create_table "note_versions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "note_id", null: false
    t.text "previous_body", null: false
    t.index ["note_id"], name: "index_note_versions_on_note_id"
  end

  create_table "notes", force: :cascade do |t|
    t.boolean "ai_generated", default: false, null: false
    t.string "ai_model"
    t.bigint "author_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.string "css_selector"
    t.datetime "edited_at"
    t.integer "helpful_count", default: 0, null: false
    t.integer "not_helpful_count", default: 0, null: false
    t.bigint "page_id", null: false
    t.integer "reports_count", default: 0, null: false
    t.text "selected_text", null: false
    t.string "short_id", limit: 8
    t.integer "somewhat_count", default: 0, null: false
    t.boolean "sources_linked"
    t.integer "status", default: 0, null: false
    t.string "text_prefix"
    t.string "text_suffix"
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_notes_on_author_id"
    t.index ["page_id"], name: "index_notes_on_page_id"
    t.index ["short_id"], name: "index_notes_on_short_id", unique: true
  end

  create_table "pages", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "domain"
    t.string "title"
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.index ["domain"], name: "index_pages_on_domain"
    t.index ["url"], name: "index_pages_on_url", unique: true
  end

  create_table "ratings", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "helpfulness", null: false
    t.bigint "note_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["note_id"], name: "index_ratings_on_note_id"
    t.index ["user_id", "note_id"], name: "index_ratings_on_user_id_and_note_id", unique: true
    t.index ["user_id"], name: "index_ratings_on_user_id"
  end

  create_table "reports", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "note_id", null: false
    t.integer "reason", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id", "note_id"], name: "index_reports_on_user_id_and_note_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "account_created_at"
    t.string "auth_token"
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "display_name"
    t.integer "follower_count"
    t.float "karma", default: 0.0, null: false
    t.float "rating_impact", default: 0.0, null: false
    t.float "reputation_score", default: 0.0
    t.integer "role", default: 0, null: false
    t.string "twitter_handle"
    t.string "twitter_uid", null: false
    t.datetime "updated_at", null: false
    t.index ["auth_token"], name: "index_users_on_auth_token", unique: true
    t.index ["twitter_handle"], name: "index_users_on_twitter_handle", unique: true
    t.index ["twitter_uid"], name: "index_users_on_twitter_uid", unique: true
  end

  add_foreign_key "note_status_changes", "notes"
  add_foreign_key "note_versions", "notes"
  add_foreign_key "notes", "pages"
  add_foreign_key "notes", "users", column: "author_id"
  add_foreign_key "ratings", "notes"
  add_foreign_key "ratings", "users"
  add_foreign_key "reports", "notes"
  add_foreign_key "reports", "users"
end
